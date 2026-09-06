"""
tools.py -- the ONLY way the assistant is allowed to touch business numbers.

Every function on BusinessTools is a plain, narrow, read-only query
against a single Business, reusing the aggregate methods already proven
out on the Business model itself (profit_summary, top_products,
customers_in_debt, etc. -- see sales/models.py). Gemini never sees the
database: it sees these functions' JSON-serializable return values, and
nothing else. That is the entire mechanism behind "without guessing" --
the model is structurally incapable of inventing a profit figure, because
a profit figure only ever enters the conversation as the return value of
get_profit_summary() below.

Every date question ("this month", "last week"...) is resolved to exact
calendar dates IN PYTHON, via resolve_period(), before any query runs.
The model picks a period NAME off a fixed enum -- it never supplies a raw
date itself. That removes the most common way an LLM tool-use system
quietly goes wrong: the model guessing today's date, miscounting a month
boundary, or assuming a fiscal period that doesn't match the calendar.
"""
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

PERIOD_CHOICES = ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_year"]


def resolve_period(period: str):
    """Named period -> (start_date, end_date, human_label), anchored to
    the real current date. Falls back to 'this_month' for anything
    unrecognized rather than raising mid-conversation -- an unrecognized
    period is a model mistake, not a reason to break the chat."""
    today = timezone.localdate()

    if period == "today":
        return today, today, "today"
    if period == "yesterday":
        y = today - timedelta(days=1)
        return y, y, f"yesterday ({y:%d %b})"
    if period == "this_week":
        start = today - timedelta(days=today.weekday())
        return start, today, f"this week ({start:%d %b}\u2013{today:%d %b})"
    if period == "last_week":
        this_week_start = today - timedelta(days=today.weekday())
        start = this_week_start - timedelta(days=7)
        end = this_week_start - timedelta(days=1)
        return start, end, f"last week ({start:%d %b}\u2013{end:%d %b})"
    if period == "this_month":
        start = today.replace(day=1)
        return start, today, f"this month ({start:%d %b}\u2013{today:%d %b %Y})"
    if period == "last_month":
        first_of_this_month = today.replace(day=1)
        end = first_of_this_month - timedelta(days=1)
        start = end.replace(day=1)
        return start, end, f"last month ({start:%B %Y})"
    if period == "this_year":
        start = today.replace(month=1, day=1)
        return start, today, f"{today.year} so far"

    start = today.replace(day=1)
    return start, today, f"this month ({start:%d %b}\u2013{today:%d %b %Y})"


def _money(d) -> float:
    """Gemini's function-response JSON wants plain floats, not Decimal --
    convert at this one boundary. All internal business math stays
    Decimal (see models.py) right up until it has to leave Python."""
    return float(d if isinstance(d, Decimal) else Decimal(str(d)))


class BusinessTools:
    """
    One instance per request, bound to one ALREADY permission-checked
    Business -- assistant.py's views are responsible for confirming the
    requesting user can see this business before a BusinessTools is ever
    constructed. These methods trust that if they're being called at all,
    the caller has the right to see these numbers.
    """

    def __init__(self, business):
        self.business = business

    def get_profit_summary(self, period: str = "this_month") -> dict:
        """Revenue, cost of goods sold, expenses, and net profit for a period."""
        start, end, label = resolve_period(period)
        s = self.business.profit_summary(start, end)
        return {
            "period": label,
            "revenue": _money(s["revenue"]),
            "returns": _money(s["returns"]),
            "cost_of_goods_sold": _money(s["cost_of_goods_sold"]),
            "gross_profit": _money(s["gross_profit"]),
            "expenses": _money(s["expenses"]),
            "net_profit": _money(s["net_profit"]),
            "currency": "TZS",
        }

    def get_sales_performance(self, period: str = "this_month") -> dict:
        """Net profit and revenue for this period vs the immediately
        preceding period of the SAME length, plus a daily revenue trend --
        so 'how are sales performing' means something concrete: growing,
        flat, or shrinking, against real prior numbers, not a vibe."""
        start, end, label = resolve_period(period)
        current = self.business.profit_summary(start, end)
        span = (end - start).days + 1
        prev_end = start - timedelta(days=1)
        prev_start = prev_end - timedelta(days=span - 1)
        previous = self.business.profit_summary(prev_start, prev_end)

        trend = [
            {
                "date": row["period"].strftime("%Y-%m-%d") if row["period"] else None,
                "revenue": _money(row["revenue"] or Decimal("0")),
                "units_sold": row["units_sold"] or 0,
            }
            for row in self.business.performance_trend(start, end, granularity="daily")
        ]

        def pct_change(new, old):
            # Can't compute a meaningful percentage change off a zero
            # base -- return None and let the model say "no prior sales
            # to compare against" instead of a nonsensical "+inf%".
            if old == 0:
                return None
            return round(float((new - old) / old * 100), 1)

        return {
            "period": label,
            "current_revenue": _money(current["revenue"]),
            "previous_revenue": _money(previous["revenue"]),
            "revenue_change_percent": pct_change(current["revenue"], previous["revenue"]),
            "current_net_profit": _money(current["net_profit"]),
            "previous_net_profit": _money(previous["net_profit"]),
            "profit_change_percent": pct_change(current["net_profit"], previous["net_profit"]),
            "daily_trend": trend,
            "currency": "TZS",
        }

    def get_top_selling_products(self, period: str = "this_month", limit: int = 5) -> dict:
        """Products ranked by sales VELOCITY (units sold per day in the
        period) -- not raw total. A product in stock 3 days that's flying
        off the shelf should outrank one with the same total spread over
        30 days; ranking by total alone hides exactly that."""
        start, end, label = resolve_period(period)
        span_days = max((end - start).days + 1, 1)
        overfetched = self.business.top_products(start, end, limit=max(limit * 3, limit))
        ranked = sorted(
            (
                {
                    "name": p.name,
                    "units_sold": p.units_sold or 0,
                    "units_per_day": round((p.units_sold or 0) / span_days, 2),
                }
                for p in overfetched
            ),
            key=lambda r: r["units_per_day"],
            reverse=True,
        )[:limit]
        return {"period": label, "products": ranked}

    def get_slow_moving_products(self, period: str = "this_month", limit: int = 5) -> dict:
        """Products that sold the LEAST in the period -- candidates for a
        promotion or discontinuing. Distinct from restock recommendations,
        which are about running out, not about failing to sell."""
        start, end, label = resolve_period(period)
        qs = self.business.least_selling_products(start, end, limit=limit)
        return {"period": label, "products": [{"name": p.name, "units_sold": p.units_sold or 0} for p in qs]}

    def get_restock_recommendations(self) -> dict:
        """Products at or below their reorder threshold RIGHT NOW. Not
        period-bound -- stock level is a current fact, not a historical one."""
        qs = self.business.low_stock_products()
        items = [
            {"name": p.name, "current_stock": p.stock_quantity, "reorder_threshold": p.low_stock_threshold}
            for p in qs
        ]
        return {"count": len(items), "products": items}

    def get_customers_who_owe_money(self, limit: int = 15) -> dict:
        """Customers with an outstanding balance right now, highest first,
        plus the total owed across ALL of them (not just the ones listed --
        the total is a separate real aggregate, not a sum of the sample)."""
        qs = self.business.customers_in_debt()[:limit]
        total = self.business.total_customer_debt()
        return {
            "total_owed_to_you": _money(total),
            "currency": "TZS",
            "customers": [{"name": c.name, "phone": c.phone, "balance_owed": _money(c.balance)} for c in qs],
        }

    def get_suppliers_you_owe(self, limit: int = 15) -> dict:
        """Suppliers the business still owes money to, highest first --
        the mirror image of get_customers_who_owe_money."""
        qs = self.business.suppliers_owed()[:limit]
        total = self.business.total_supplier_debt()
        return {
            "total_you_owe": _money(total),
            "currency": "TZS",
            "suppliers": [{"name": s.name, "phone": s.phone, "balance_owed": _money(s.balance)} for s in qs],
        }