"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { SaleListItem } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icons } from "@/components/ui/Icons";

export default function SalesHistoryPage() {
  const params = useParams();
  const businessId = Number(params.businessId);
  const { t } = useI18n();

  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchSales = (pageNum: number) => {
    if (!businessId) return;
    setIsLoading(true);
    api
      .getSales(businessId, pageNum)
      .then((res) => {
        setSales(res.data.results || []);
        const total = Math.ceil((res.data.count || 0) / 30);
        setTotalPages(total > 0 ? total : 1);
        setPage(pageNum);
      })
      .catch((err) => console.error("Failed to load sales:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchSales(1);
  }, [businessId]);

  const filteredSales = sales.filter((s) =>
    s.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    String(s.id).includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("sales_history")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete record of orders, counter sales, and customer debts
          </p>
        </div>
        <Link href={`/${businessId}/sales/new`}>
          <Button size="sm" className="gap-1.5 shadow-sm">
            <Icons.Plus size={15} />
            <span>{t("record_sale")}</span>
          </Button>
        </Link>
      </div>

      {/* Filter / Search Bar */}
      <div className="relative max-w-sm">
        <Icons.Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by order # or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Sales Table Card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
              Loading sales history...
            </div>
          ) : filteredSales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="px-5 py-3">Order</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-right">Paid</th>
                    <th className="px-5 py-3 text-right">Balance</th>
                    <th className="px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSales.map((sale) => (
                    <tr
                      key={sale.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                        <Link href={`/${businessId}/sales/${sale.id}`} className="hover:underline">
                          #{sale.id}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                        {sale.customer_name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                        {formatDate(sale.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatMoney(sale.total_amount)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-emerald-600 dark:text-emerald-400">
                        {formatMoney(sale.amount_paid)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-red-600 dark:text-red-400">
                        {Number(sale.balance) > 0 ? formatMoney(sale.balance) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge
                          size="sm"
                          variant={
                            sale.status === "paid"
                              ? "success"
                              : sale.status === "partial"
                              ? "warning"
                              : "danger"
                          }
                        >
                          {sale.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              {t("no_sales_yet")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => fetchSales(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => fetchSales(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

