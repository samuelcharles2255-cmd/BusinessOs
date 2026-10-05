"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { DashboardData } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icons } from "@/components/ui/Icons";
import { TrendChart } from "@/components/dashboard/TrendChart";

export default function DashboardPage() {
  const params = useParams();
  const businessId = Number(params.businessId);
  const { t } = useI18n();

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quick restock modal state
  const [restockProduct, setRestockProduct] = useState<{ id: number; name: string } | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [isRestocking, setIsRestocking] = useState(false);

  const fetchDashboard = () => {
    if (!businessId) return;
    setIsLoading(true);
    api
      .getDashboard(businessId)
      .then((res) => setData(res.data))
      .catch((err) => console.error("Failed to load dashboard:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, [businessId]);

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct || !restockQty) return;
    setIsRestocking(true);
    try {
      await api.restockProduct(businessId, restockProduct.id, {
        quantity: parseInt(restockQty),
      });
      setRestockProduct(null);
      setRestockQty("");
      fetchDashboard();
    } catch (err) {
      console.error("Restock failed:", err);
    } finally {
      setIsRestocking(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-white/10 dark:bg-white/[0.04] rounded-xl w-1/4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white/10 dark:bg-white/[0.04] rounded-2xl" />
          ))}
        </div>
        <div className="h-72 bg-white/10 dark:bg-white/[0.04] rounded-2xl" />
      </div>
    );
  }

  const summary = data?.summary || {
    revenue: 0,
    gross_profit: 0,
    cost_of_goods_sold: 0,
    expenses: 0,
    net_profit: 0,
  };

  return (
    <div className="space-y-6">
      {/* Spacecraft Telemetry Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-cosmic-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-bold">
              // TELEMETRY CONSOLE
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            {t("dashboard")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Operational timeline: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{data?.period_label}</span>
          </p>
        </div>

        {/* Quick Action buttons */}
        <div className="flex items-center gap-2">
          <Link href={`/${businessId}/sales/new`}>
            <Button size="sm" className="gap-1.5 shadow-md">
              <Icons.Plus size={15} />
              <span>{t("record_sale")}</span>
            </Button>
          </Link>
          <Link href={`/${businessId}/purchases`}>
            <Button variant="secondary" size="sm" className="gap-1.5">
              <Icons.Truck size={15} />
              <span className="hidden sm:inline">{t("receive_stock")}</span>
            </Button>
          </Link>
          <Link href={`/${businessId}/expenses`}>
            <Button variant="secondary" size="sm" className="gap-1.5">
              <Icons.Receipt size={15} />
              <span className="hidden sm:inline">{t("add_expense")}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Financial Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Profit */}
        <Card className="relative overflow-hidden group border-emerald-500/30 dark:border-emerald-500/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors" />
          <CardContent className="p-4 sm:p-5 relative z-10">
            <div className="flex items-center justify-between text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              <span>{t("net_profit")}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-cosmic-pulse" />
            </div>
            <div className={`text-xl sm:text-2xl font-bold font-mono mt-1.5 tracking-tight ${
              summary.net_profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}>
              {formatMoney(summary.net_profit)}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{t("net_profit_sub")}</div>
          </CardContent>
        </Card>

        {/* Net Revenue */}
        <Card className="relative overflow-hidden group border-cyan-500/30 dark:border-cyan-500/20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/20 transition-colors" />
          <CardContent className="p-4 sm:p-5 relative z-10">
            <div className="flex items-center justify-between text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              <span>{t("net_revenue")}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono mt-1.5 tracking-tight text-slate-900 dark:text-cyan-300">
              {formatMoney(summary.revenue)}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{t("net_revenue_sub")}</div>
          </CardContent>
        </Card>

        {/* Gross Profit / COGS */}
        <Card className="relative overflow-hidden group">
          <CardContent className="p-4 sm:p-5 relative z-10">
            <div className="flex items-center justify-between text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              <span>{t("gross_profit")}</span>
              <span className="text-[10px] text-slate-400 font-mono">MARGIN</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono mt-1.5 tracking-tight text-slate-900 dark:text-slate-100">
              {formatMoney(summary.gross_profit)}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
              {t("cogs")}: {formatMoney(summary.cost_of_goods_sold)}
            </div>
          </CardContent>
        </Card>

        {/* Operating Expenses */}
        <Card className="relative overflow-hidden group">
          <CardContent className="p-4 sm:p-5 relative z-10">
            <div className="flex items-center justify-between text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
              <span>{t("operating_expenses")}</span>
              <span className="text-[10px] text-slate-400 font-mono">OUTFLOW</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono mt-1.5 tracking-tight text-slate-900 dark:text-slate-100">
              {formatMoney(summary.expenses)}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{t("expenses_sub")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Radar Row: Low Stock & Debtors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock Radar */}
        <Card className="border-rose-500/30 dark:border-rose-500/20">
          <CardHeader className="py-3 px-5">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-cosmic-pulse" />
                <span>{t("low_stock_warning")}</span>
              </CardTitle>
              <CardDescription>{t("low_stock_sub")}</CardDescription>
            </div>
            <Link href={`/${businessId}/products`}>
              <Button variant="ghost" size="sm" className="text-xs">
                {t("view_all")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {data?.low_stock && data.low_stock.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {data.low_stock.map((prod) => (
                  <div key={prod.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {prod.name}
                      </div>
                      <div className="text-[11px] text-rose-500 font-mono mt-0.5">
                        Only {prod.stock_quantity} remaining (threshold: {prod.low_stock_threshold})
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-rose-500/30 hover:border-rose-500"
                      onClick={() => setRestockProduct(prod)}
                    >
                      + {t("restock")}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-mono">
                <Icons.CheckCircle size={15} />
                <span>{t("all_inventory_safe")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Debts Radar */}
        <Card className="border-amber-500/30 dark:border-amber-500/20">
          <CardHeader className="py-3 px-5">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-cosmic-pulse" />
                <span>{t("customer_debt")}</span>
              </CardTitle>
              <CardDescription>{t("customer_debt_sub")}</CardDescription>
            </div>
            <Link href={`/${businessId}/customers?filter=debt`}>
              <Button variant="ghost" size="sm" className="text-xs">
                {t("view_all")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {data?.customers_in_debt && data.customers_in_debt.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {data.customers_in_debt.map((c) => (
                  <div key={c.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {c.phone || "No phone registered"}
                      </div>
                    </div>
                    <Badge variant="warning" dot>
                      {t("owes")} {formatMoney(c.balance)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-mono">
                <Icons.CheckCircle size={15} />
                <span>{t("no_customer_debts")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cosmic Trend Chart Panel */}
      <Card>
        <CardHeader className="py-4 px-5">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>{t("daily_sales_trend")}</span>
            </CardTitle>
            <CardDescription>
              Counter transactions & volume plotted across active timeline
            </CardDescription>
          </div>
          <Badge variant="info" dot>Telemetry Live</Badge>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <TrendChart
            labels={data?.trend_labels || []}
            revenue={data?.trend_revenue || []}
            units={data?.trend_units || []}
          />
        </CardContent>
      </Card>

      {/* AI Assistant Console Banner */}
      <Card className="relative overflow-hidden border-cyan-500/30 dark:border-cyan-500/20 bg-gradient-to-r from-indigo-500/10 via-cyan-500/10 to-transparent">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-cyan-500/25">
                AI
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-300 animate-ping opacity-75" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{t("ai_assistant")}</span>
                  <Badge size="sm" variant="info">Gemini Pro</Badge>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("ai_subtitle")}
                </p>
              </div>
            </div>
            <Link href={`/${businessId}/assistant`}>
              <Button size="sm" className="gap-1.5 shadow-md">
                <span>Launch Assistant Console</span>
                <span>&rarr;</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Sales & Recent Expenses Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Sales */}
        <Card>
          <CardHeader className="py-3 px-5">
            <div>
              <CardTitle className="text-sm font-semibold">{t("recent_sales")}</CardTitle>
              <CardDescription>Latest counter transactions</CardDescription>
            </div>
            <Link href={`/${businessId}/sales`}>
              <Button variant="ghost" size="sm" className="text-xs">
                {t("view_all")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data?.recent_sales && data.recent_sales.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {data.recent_sales.map((sale) => (
                  <Link
                    key={sale.id}
                    href={`/${businessId}/sales/${sale.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          #{sale.id}
                        </span>
                        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {sale.customer_name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {formatDate(sale.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
                        {formatMoney(sale.total_amount)}
                      </div>
                      <Badge
                        size="sm"
                        dot
                        variant={
                          sale.status === "paid"
                            ? "success"
                            : sale.status === "partial"
                            ? "warning"
                            : "danger"
                        }
                        className="mt-1"
                      >
                        {sale.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 font-mono">
                {t("no_sales_yet")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Expenses */}
        <Card>
          <CardHeader className="py-3 px-5">
            <div>
              <CardTitle className="text-sm font-semibold">{t("recent_expenses")}</CardTitle>
              <CardDescription>{t("expenses_sub")}</CardDescription>
            </div>
            <Link href={`/${businessId}/expenses`}>
              <Button variant="ghost" size="sm" className="text-xs">
                {t("view_all")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data?.recent_expenses && data.recent_expenses.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {data.recent_expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {exp.description}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge size="sm" variant="neutral">
                          {exp.category || "General"}
                        </Badge>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDate(exp.date)}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">
                      -{formatMoney(exp.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 font-mono">
                {t("no_expenses_month")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Restock Modal */}
      <Modal
        isOpen={!!restockProduct}
        onClose={() => setRestockProduct(null)}
        title={`Restock: ${restockProduct?.name || ""}`}
        description="Add inventory units to stock reserves"
      >
        <form onSubmit={handleRestockSubmit} className="space-y-4">
          <Input
            label="Quantity to Add *"
            type="number"
            min="1"
            placeholder="e.g. 50"
            value={restockQty}
            onChange={(e) => setRestockQty(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRestockProduct(null)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" isLoading={isRestocking}>
              {t("restock")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
