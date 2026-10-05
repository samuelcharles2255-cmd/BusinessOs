"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Sale } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icons } from "@/components/ui/Icons";

export default function SaleDetailPage() {
  const params = useParams();
  const businessId = Number(params.businessId);
  const saleId = Number(params.saleId);
  const { t } = useI18n();

  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Add payment modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentRef, setPaymentRef] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const fetchSale = () => {
    if (!saleId) return;
    setIsLoading(true);
    api
      .getSale(saleId)
      .then((res) => {
        setSale(res.data);
      })
      .catch((err) => console.error("Failed to load sale:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchSale();
  }, [saleId]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !sale) return;
    setIsSubmittingPayment(true);
    try {
      await api.addPayment(businessId, "sale", sale.id, {
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        reference: paymentRef,
      });
      setIsPaymentModalOpen(false);
      setPaymentAmount("");
      setPaymentRef("");
      fetchSale();
    } catch (err) {
      console.error("Failed to add payment:", err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (isLoading && !sale) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
        Loading sale details...
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Sale #{saleId} could not be found.
      </div>
    );
  }

  const balanceNum = Number(sale.balance) || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/${businessId}/sales`}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              &larr; Sales
            </Link>
            <span className="text-xs text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Sale #{sale.id}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Order #{sale.id}
            </h1>
            <Badge
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
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Recorded on {formatDate(sale.created_at)}
          </p>
        </div>

        {balanceNum > 0 && (
          <Button
            size="sm"
            onClick={() => {
              setPaymentAmount(String(balanceNum));
              setIsPaymentModalOpen(true);
            }}
          >
            + Record Installment Payment
          </Button>
        )}
      </div>

      {/* Customer and Totals Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase">Customer</div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
              {sale.customer_name}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {sale.customer_phone || "Walk-in sale"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase">Total Amount</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatMoney(sale.total_amount)}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              Paid: {formatMoney(sale.amount_paid)}
            </div>
          </CardContent>
        </Card>

        <Card className={balanceNum > 0 ? "border-amber-500/40 bg-amber-500/5" : ""}>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase">Balance Due</div>
            <div
              className={`text-xl font-bold mt-1 ${
                balanceNum > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {formatMoney(sale.balance)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {balanceNum > 0 ? "Customer debt pending" : "Fully paid"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items Table */}
      <Card>
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-sm font-semibold">Items Sold</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3 text-center">Qty</th>
                  <th className="px-5 py-3 text-right">Unit Price</th>
                  <th className="px-5 py-3 text-right">Subtotal</th>
                  {sale.returns?.length > 0 && <th className="px-5 py-3 text-center">Returned</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sale.items?.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {item.product_name}
                    </td>
                    <td className="px-5 py-3 text-center font-medium">{item.quantity}</td>
                    <td className="px-5 py-3 text-right text-slate-600 dark:text-slate-400">
                      {formatMoney(item.unit_price)}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatMoney(item.subtotal)}
                    </td>
                    {sale.returns?.length > 0 && (
                      <td className="px-5 py-3 text-center text-red-500 font-semibold">
                        {item.returned_quantity > 0 ? item.returned_quantity : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-sm font-semibold">Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sale.payments?.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {sale.payments.map((p) => (
                <div
                  key={p.id}
                  className="px-5 py-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mr-2">
                      {p.method}
                    </span>
                    {p.reference && (
                      <span className="text-slate-400 font-mono">Ref: {p.reference}</span>
                    )}
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {formatDate(p.created_at)}
                    </div>
                  </div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatMoney(p.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">No payments logged.</div>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Installment Payment"
        description={`Outstanding balance: ${formatMoney(sale.balance)}`}
      >
        <form onSubmit={handleAddPayment} className="space-y-4">
          <Input
            label="Payment Amount *"
            type="number"
            step="any"
            max={balanceNum}
            min="1"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
            autoFocus
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full h-10 px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="cash">{t("cash")}</option>
              <option value="mpesa">{t("mpesa")}</option>
              <option value="tigopesa">{t("tigopesa")}</option>
              <option value="airtelmoney">{t("airtelmoney")}</option>
              <option value="halopesa">{t("halopesa")}</option>
            </select>
          </div>

          <Input
            label="Reference Note (optional)"
            placeholder="e.g. MPesa transaction code"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" isLoading={isSubmittingPayment}>
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

