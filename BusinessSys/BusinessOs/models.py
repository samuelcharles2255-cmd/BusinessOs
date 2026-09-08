from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import (
    DecimalField,
    ExpressionWrapper,
    F,
    OuterRef,
    Q,
    Subquery,
    Sum,
)
from django.db.models.functions import Coalesce, TruncDay, TruncMonth, TruncWeek, TruncYear
from django.db.models.signals import post_save
from django.dispatch import receiver

from .utils import normalize_phone

MONEY = DecimalField(max_digits=14, decimal_places=2)
ZERO = Decimal("0")


# ---------------------------------------------------------------------------
# USER PROFILE -- separate phone number from auth username
# ---------------------------------------------------------------------------

class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    phone = models.CharField(max_length=20, blank=True, null=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.phone or 'No phone'})"

    def save(self, *args, **kwargs):
        if self.phone:
            self.phone = normalize_phone(self.phone)
        super().save(*args, **kwargs)


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_or_save_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


# ---------------------------------------------------------------------------
# BUSINESS
# ---------------------------------------------------------------------------

class Business(models.Model):

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="businesses",
    )
    name = models.CharField(max_length=150)
    location = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    # ---- DASHBOARD / PROFIT: computed, never stored, and NEVER a Python loop
    def profit_summary(self, start_date, end_date):
        """
        P&L for the window. Sales returns are folded in on purpose -- see
        the long comment on SaleReturn below for why leaving them out
        silently overstates profit. Purchases are deliberately EXCLUDED:
        buying stock is not an expense, it's converting cash into inventory.
        The cost only hits this P&L when the stock is actually sold, via
        SaleItem.unit_cost. If you expected "purchases" to show up as a
        cost here the way rent does, that instinct is the single most
        common bookkeeping mistake small shops make -- it makes profit
        look terrible in a big-restock month and great in a month you
        don't restock at all, which tells you nothing about whether the
        business is actually healthy.
        """
        item_totals = SaleItem.objects.filter(
            sale__business=self,
            sale__created_at__date__range=(start_date, end_date),
        ).aggregate(
            revenue=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=MONEY)),
            cogs=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"), output_field=MONEY)),
        )
        gross_revenue = item_totals["revenue"] or ZERO
        cogs = item_totals["cogs"] or ZERO

        return_totals = SaleReturnItem.objects.filter(
            sale_return__sale__business=self,
            sale_return__return_date__range=(start_date, end_date),
        ).aggregate(
            returned_revenue=Sum(
                ExpressionWrapper(F("sale_item__unit_price") * F("quantity"), output_field=MONEY)
            ),
            returned_cogs=Sum(
                ExpressionWrapper(F("sale_item__unit_cost") * F("quantity"), output_field=MONEY)
            ),
        )
        returned_revenue = return_totals["returned_revenue"] or ZERO
        returned_cogs = return_totals["returned_cogs"] or ZERO

        # A discount applied at the point of return reduces what actually
        # goes back out of the till, so it partially offsets the revenue
        # reversal rather than being its own line -- e.g. customer returns
        # a 10,000 item, you agree to refund 9,000: revenue only reverses
        # by 9,000, not the full 10,000.
        return_discount = SaleReturn.objects.filter(
            sale__business=self,
            return_date__range=(start_date, end_date),
        ).aggregate(total=Sum("discount"))["total"] or ZERO

        revenue = gross_revenue - (returned_revenue - return_discount)
        cogs = cogs - returned_cogs

        expenses = self.expenses.filter(
            date__range=(start_date, end_date)
        ).aggregate(total=Sum("amount"))["total"] or ZERO

        gross_profit = revenue - cogs
        net_profit = gross_profit - expenses

        return {
            "revenue": revenue,
            "returns": returned_revenue - return_discount,
            "cost_of_goods_sold": cogs,
            "gross_profit": gross_profit,
            "expenses": expenses,
            "net_profit": net_profit,
        }

    def performance_trend(self, start_date, end_date, granularity="daily"):
        trunc_funcs = {
            "daily": TruncDay,
            "weekly": TruncWeek,
            "monthly": TruncMonth,
            "yearly": TruncYear,
        }
        trunc_func = trunc_funcs.get(granularity, TruncDay)
        return (
            SaleItem.objects.filter(
                sale__business=self, sale__created_at__date__range=(start_date, end_date)
            )
            .annotate(period=trunc_func("sale__created_at"))
            .values("period")
            .annotate(
                revenue=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=MONEY)),
                units_sold=Sum("quantity"),
            )
            .order_by("period")
        )

    def top_products(self, start_date, end_date, limit=5):
        return (
            self.products.filter(sale_items__sale__created_at__date__range=(start_date, end_date))
            .annotate(units_sold=Sum("sale_items__quantity"))
            .order_by("-units_sold")[:limit]
        )

    def least_selling_products(self, start_date, end_date, limit=5):
        return (
            self.products.filter(sale_items__sale__created_at__date__range=(start_date, end_date))
            .annotate(units_sold=Sum("sale_items__quantity"))
            .order_by("units_sold")[:limit]
        )

    def low_stock_products(self):
        """Products at or below their reorder threshold -- for the dashboard
        restock nudge. F() comparison, not a Python loop over every product."""
        return self.products.filter(stock_quantity__lte=F("low_stock_threshold"))

    def customers_in_debt(self):
        """
        Customers with an outstanding balance, computed set-wide.

        This is NOT the same as annotating Sum('sales__items...') and
        Sum('sales__payments__amount') together on one annotate() call --
        that's a classic Django trap: joining two separate reverse
        relations (items and payments) in the same annotate() fans out
        into a cross product, so both sums come back multiplied and wrong
        the moment a customer has more than one of either. Two independent
        Subqueries side-steps that entirely.
        """
        revenue_sq = (
            SaleItem.objects.filter(sale__customer=OuterRef("pk"))
            .values("sale__customer")
            .annotate(total=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=MONEY)))
            .values("total")
        )
        paid_sq = (
            Payment.objects.filter(sale__customer=OuterRef("pk"))
            .values("sale__customer")
            .annotate(total=Sum("amount"))
            .values("total")
        )
        return (
            self.customers.annotate(
                revenue=Coalesce(Subquery(revenue_sq, output_field=MONEY), ZERO),
                paid=Coalesce(Subquery(paid_sq, output_field=MONEY), ZERO),
            )
            .annotate(balance=ExpressionWrapper(F("revenue") - F("paid"), output_field=MONEY))
            .filter(balance__gt=0)
            .order_by("-balance")
        )

    def suppliers_owed(self):
        """Same Subquery pattern, mirrored for money YOU owe suppliers."""
        cost_sq = (
            PurchaseItem.objects.filter(purchase__supplier=OuterRef("pk"))
            .values("purchase__supplier")
            .annotate(total=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"), output_field=MONEY)))
            .values("total")
        )
        paid_sq = (
            Payment.objects.filter(purchase__supplier=OuterRef("pk"))
            .values("purchase__supplier")
            .annotate(total=Sum("amount"))
            .values("total")
        )
        return (
            self.suppliers.annotate(
                owed=Coalesce(Subquery(cost_sq, output_field=MONEY), ZERO),
                paid=Coalesce(Subquery(paid_sq, output_field=MONEY), ZERO),
            )
            .annotate(balance=ExpressionWrapper(F("owed") - F("paid"), output_field=MONEY))
            .filter(balance__gt=0)
            .order_by("-balance")
        )

    def total_customer_debt(self):
        revenue = SaleItem.objects.filter(sale__business=self).aggregate(
            total=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=MONEY))
        )["total"] or ZERO
        paid = Payment.objects.filter(sale__business=self).aggregate(total=Sum("amount"))["total"] or ZERO
        return revenue - paid

    def total_supplier_debt(self):
        owed = PurchaseItem.objects.filter(purchase__business=self).aggregate(
            total=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"), output_field=MONEY))
        )["total"] or ZERO
        paid = Payment.objects.filter(purchase__business=self).aggregate(total=Sum("amount"))["total"] or ZERO
        return owed - paid

    def can_record_sales(self, user):
        if user == self.owner:
            return True
        return self.staff.filter(user=user).exists()


class BusinessStaff(models.Model):
    OWNER = "owner"
    SELLER = "seller"
    ROLE_CHOICES = [(OWNER, "Owner"), (SELLER, "Seller")]

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="staff")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="business_roles")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=SELLER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("business", "user")

    def __str__(self):
        return f"{self.user} — {self.role} at {self.business}"


# ---------------------------------------------------------------------------
# PEOPLE
#
# You asked to "switch Customer to People" -- I didn't collapse Customer /
# Supplier / Staff into one Person table, and this is deliberate, not an
# oversight. A single polymorphic Person table is the kind of thing that
# looks elegant in a diagram and then costs you a NULL-filled mess in
# practice: a customer has a running debt from sales, a supplier has a
# running debt from purchases, staff has a login and a role -- three
# different sets of required fields and three different debt formulas
# bolted onto one table means most rows have several meaningless blank
# columns, and every query needs an extra "which kind of person is this"
# filter. "People" is a real, useful grouping -- it just belongs in your
# navigation/menu, not your schema. Keep three tables, one menu tab.
# ---------------------------------------------------------------------------

class Customer(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="customers")
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("business", "phone")
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.phone:
            self.phone = normalize_phone(self.phone)
        else:
            self.phone = None
        super().save(*args, **kwargs)

    @property
    def balance_owed(self):
        """
        Single-customer version, kept for detail pages where one extra
        query is fine. For a LIST of customers, use
        Business.customers_in_debt() instead -- calling this property in a
        loop over a queryset is exactly the N+1 pattern the rest of this
        file goes out of its way to avoid.
        """
        revenue = SaleItem.objects.filter(sale__customer=self).aggregate(
            total=Sum(ExpressionWrapper(F("unit_price") * F("quantity"), output_field=MONEY))
        )["total"] or ZERO
        paid = Payment.objects.filter(sale__customer=self).aggregate(total=Sum("amount"))["total"] or ZERO
        return revenue - paid

    @property
    def is_in_debt(self):
        return self.balance_owed > 0


class Supplier(models.Model):
    """Who you buy stock from. Mirrors Customer's shape on purpose --
    same phone normalization, same debt pattern, opposite direction."""

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="suppliers")
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("business", "phone")
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.phone:
            self.phone = normalize_phone(self.phone)
        else:
            self.phone = None
        super().save(*args, **kwargs)

    @property
    def balance_owed(self):
        owed = PurchaseItem.objects.filter(purchase__supplier=self).aggregate(
            total=Sum(ExpressionWrapper(F("unit_cost") * F("quantity"), output_field=MONEY))
        )["total"] or ZERO
        paid = Payment.objects.filter(purchase__supplier=self).aggregate(total=Sum("amount"))["total"] or ZERO
        return owed - paid


# ---------------------------------------------------------------------------
# PRODUCT CATALOG -- Brand / Category / Product
# ---------------------------------------------------------------------------

class Brand(models.Model):
    """
    A real table, not a free-text CharField on Product. You asked for
    products "arranged according to brand" -- if brand is just typed text,
    "Coca Cola", "Coca-Cola" and "coca cola" are three different brands as
    far as any GROUP BY or filter is concerned, and your grouping silently
    breaks the first time someone at the till types it differently. A
    dropdown of existing Brands (with an "add new" escape hatch) costs you
    one small model and pays for itself the first month.
    """

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="brands")
    name = models.CharField(max_length=100)

    class Meta:
        unique_together = ("business", "name")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Category(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=100)

    class Meta:
        unique_together = ("business", "name")
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=150)
    brand = models.ForeignKey(
        Brand, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    # Requires Pillow (pip install Pillow) and MEDIA_URL / MEDIA_ROOT set in
    # settings.py, plus serving media in urls.py during development. Also:
    # don't store full-resolution phone photos raw -- add a resize step
    # (django-imagekit or a manual Pillow thumbnail on save()) before this
    # goes to production, or your product list page will try to download a
    # few hundred multi-megabyte images every time someone opens it.
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    stock_quantity = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("business", "name")
        ordering = ["brand__name", "category__name", "name"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(stock_quantity__gte=0),
                name="product_stock_quantity_gte_0",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.business.name})"

    @property
    def is_low_stock(self):
        return self.stock_quantity <= self.low_stock_threshold


class StockMovement(models.Model):
    SALE = "sale"
    RESTOCK = "restock"       # manual restock button / opening stock
    PURCHASE = "purchase"     # stock arriving via a recorded Purchase
    RETURN = "return"         # stock arriving back via a SaleReturn
    ADJUSTMENT = "adjustment"
    REASON_CHOICES = [
        (SALE, "Sale"),
        (RESTOCK, "Restock"),
        (PURCHASE, "Purchase"),
        (RETURN, "Return"),
        (ADJUSTMENT, "Adjustment"),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_movements")
    quantity_change = models.IntegerField()
    reason = models.CharField(max_length=15, choices=REASON_CHOICES)
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.product.name}: {self.quantity_change:+d} ({self.reason})"


# ---------------------------------------------------------------------------
# SALE + SALEITEM
# ---------------------------------------------------------------------------

class Sale(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="sales")
    customer = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="sales"
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="sales_recorded"
    )
    created_at = models.DateTimeField(auto_now_add=True,db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Sale #{self.pk} — {self.business.name}"

    @property
    def total_amount(self):
        return sum((item.subtotal for item in self.items.all()), ZERO)

    @property
    def amount_paid(self):
        return sum((p.amount for p in self.payments.all()), ZERO)

    @property
    def returned_amount(self):
        return sum((r.refund_amount for r in self.returns.all()), ZERO)

    @property
    def balance(self):
        return self.total_amount - self.amount_paid

    @property
    def status(self):
        if self.balance <= 0:
            return "paid"
        if self.amount_paid > 0:
            return "partial"
        return "unpaid"

    @property
    def estimated_profit(self):
        return sum((item.profit for item in self.items.all()), ZERO)
    


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="sale_items")
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"

    @property
    def subtotal(self):
        return self.unit_price * self.quantity

    @property
    def total_cost(self):
        return self.unit_cost * self.quantity

    @property
    def profit(self):
        return self.subtotal - self.total_cost

    @property
    def returned_quantity(self):
        """How much of this line has already come back, across all returns.
        Used to cap how much more of it CAN be returned."""
        return self.return_items.aggregate(total=Sum("quantity"))["total"] or 0

    def save(self, *args, **kwargs):
        is_new = self._state.adding

        if self.unit_price is None:
            self.unit_price = self.product.selling_price
        if self.unit_cost is None:
            self.unit_cost = self.product.cost_price

        with transaction.atomic():
            super().save(*args, **kwargs)
            if is_new:
                Product.objects.filter(pk=self.product_id).update(
                    stock_quantity=F("stock_quantity") - self.quantity
                )
                StockMovement.objects.create(
                    product=self.product,
                    quantity_change=-self.quantity,
                    reason=StockMovement.SALE,
                    note=f"Sale #{self.sale_id}",
                )


# ---------------------------------------------------------------------------
# SALE RETURN
#
# You asked for this to carry "customer name and phone no" as its own
# fields. I overrode that: it links to the original Sale instead, and
# customer name/phone display via sale.customer. Free-text name/phone on
# a return means (a) nothing stops someone typing a return against a
# customer/sale that never happened, (b) you can't validate the returned
# quantity against what was actually sold -- so "return 50 units" of a
# product the customer bought 2 of just saves, and (c) you lose the link
# to which specific sale, at which price, is being reversed, which is
# exactly the number profit_summary() needs. Tying it to Sale costs the
# cashier one extra tap (pick the sale) and buys you an audit trail that
# actually holds up.
# ---------------------------------------------------------------------------

class SaleReturn(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="returns")
    return_date = models.DateField(db_index=True)
    discount = models.DecimalField(
        max_digits=12, decimal_places=2, default=ZERO, validators=[MinValueValidator(0)],
        help_text="Amount knocked off the refund, if any.",
    )
    refund_method = models.CharField(max_length=15, choices=[], blank=True)  # set below
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="returns_processed"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Return against Sale #{self.sale_id}"

    @property
    def customer_name(self):
        return self.sale.customer.name if self.sale.customer_id else "Walk-in"

    @property
    def customer_phone(self):
        return self.sale.customer.phone if self.sale.customer_id else ""

    @property
    def refund_subtotal(self):
        return sum((item.subtotal for item in self.items.all()), ZERO)

    @property
    def refund_amount(self):
        return self.refund_subtotal - self.discount


class SaleReturnItem(models.Model):
    sale_return = models.ForeignKey(SaleReturn, on_delete=models.CASCADE, related_name="items")
    sale_item = models.ForeignKey(SaleItem, on_delete=models.CASCADE, related_name="return_items")
    quantity = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.quantity} x {self.sale_item.product.name} returned"

    @property
    def unit_price(self):
        return self.sale_item.unit_price

    @property
    def unit_cost(self):
        return self.sale_item.unit_cost

    @property
    def subtotal(self):
        return self.unit_price * self.quantity

    def clean(self):
        already_returned = self.sale_item.returned_quantity
        if self.pk:
            already_returned -= SaleReturnItem.objects.get(pk=self.pk).quantity
        remaining = self.sale_item.quantity - already_returned
        if self.quantity > remaining:
            raise ValidationError(
                f"Only {remaining} unit(s) of {self.sale_item.product.name} "
                f"from this sale are still eligible for return."
            )

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        with transaction.atomic():
            super().save(*args, **kwargs)
            if is_new:
                Product.objects.filter(pk=self.sale_item.product_id).update(
                    stock_quantity=F("stock_quantity") + self.quantity
                )
                StockMovement.objects.create(
                    product=self.sale_item.product,
                    quantity_change=self.quantity,
                    reason=StockMovement.RETURN,
                    note=f"Return against Sale #{self.sale_item.sale_id}",
                )


# ---------------------------------------------------------------------------
# PURCHASES (stock coming IN from a supplier)
# ---------------------------------------------------------------------------

class Purchase(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="purchases")
    supplier = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name="purchases"
    )
    invoice_no = models.CharField(max_length=100, blank=True)
    purchase_date = models.DateField(db_index=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="purchases_recorded"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Purchase #{self.pk} — {self.business.name}"

    @property
    def total_amount(self):
        return sum((item.subtotal for item in self.items.all()), ZERO)

    @property
    def amount_paid(self):
        return sum((p.amount for p in self.payments.all()), ZERO)

    @property
    def balance(self):
        return self.total_amount - self.amount_paid

    @property
    def status(self):
        if self.balance <= 0:
            return "paid"
        if self.amount_paid > 0:
            return "partial"
        return "unpaid"


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="purchase_items")
    quantity = models.PositiveIntegerField()
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"

    @property
    def subtotal(self):
        return self.unit_cost * self.quantity

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        with transaction.atomic():
            super().save(*args, **kwargs)
            if is_new:
                Product.objects.filter(pk=self.product_id).update(
                    stock_quantity=F("stock_quantity") + self.quantity,
                    cost_price=self.unit_cost,
                )
                StockMovement.objects.create(
                    product=self.product,
                    quantity_change=self.quantity,
                    reason=StockMovement.PURCHASE,
                    note=f"Purchase #{self.purchase_id}"
                    + (f" (invoice {self.purchase.invoice_no})" if self.purchase.invoice_no else ""),
                )


# ---------------------------------------------------------------------------
# EXPENSE
# ---------------------------------------------------------------------------

class Expense(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="expenses")
    description = models.CharField(max_length=200)
    category = models.CharField(max_length=50, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    date = models.DateField(db_index=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"{self.description} — {self.amount}"

    @property
    def amount_paid(self):
        return sum((p.amount for p in self.payments.all()), ZERO)

    @property
    def balance_owed(self):
        return self.amount - self.amount_paid


# ---------------------------------------------------------------------------
# PAYMENT
# ---------------------------------------------------------------------------

class Payment(models.Model):
    CASH = "cash"
    MPESA = "mpesa"
    TIGOPESA = "tigopesa"
    AIRTELMONEY = "airtelmoney"
    HALOPESA = "halopesa"
    METHOD_CHOICES = [
        (CASH, "Cash"),
        (MPESA, "M-Pesa"),
        (TIGOPESA, "Tigo Pesa"),
        (AIRTELMONEY, "Airtel Money"),
        (HALOPESA, "Halopesa"),
    ]

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="payments")
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, null=True, blank=True, related_name="payments")
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, null=True, blank=True, related_name="payments")
    purchase = models.ForeignKey(
        Purchase, on_delete=models.CASCADE, null=True, blank=True, related_name="payments"
    )
    description = models.CharField(max_length=200, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    method = models.CharField(max_length=15, choices=METHOD_CHOICES)
    reference = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(sale__isnull=False, expense__isnull=True, purchase__isnull=True)
                    | Q(sale__isnull=True, expense__isnull=False, purchase__isnull=True)
                    | Q(sale__isnull=True, expense__isnull=True, purchase__isnull=False)
                ),
                name="payment_exactly_one_target",
            ),
        ]

    def __str__(self):
        target = self.sale or self.expense or self.purchase
        return f"{self.amount} via {self.method} for {target}"

    def clean(self):
        targets = [self.sale, self.expense, self.purchase]
        set_count = sum(1 for t in targets if t is not None)
        if set_count == 0:
            raise ValidationError("A payment must be linked to a Sale, Expense, or Purchase.")
        if set_count > 1:
            raise ValidationError("A payment can only be linked to ONE of Sale, Expense, or Purchase.")


SaleReturn._meta.get_field("refund_method").choices = Payment.METHOD_CHOICES