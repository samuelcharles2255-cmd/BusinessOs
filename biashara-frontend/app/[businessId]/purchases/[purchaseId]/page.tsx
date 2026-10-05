"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Purchase } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";

export default function PurchaseDetailPage() {
  const params = useParams();
  const businessId = Number(params.businessId);
  const purchaseId = Number(params.purchaseId);
  const { t } = useI18n();

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Add payment modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentRef, setPaymentRef] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const fetchPurchase = () => {
    if (!purchaseId) return;
    setIsLoading(true);
    api
      .getPurchase(purchaseId)
      .then((res) => setPurchase(res.data))
      .catch((err) => console.error("Failed to load purchase:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchPurchase();
  }, [purchaseId]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !purchase) return;
    setIsSubmittingPayment(true);
    try {
      await api.addPayment(businessId, "purchase", purchase.id, {
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        reference: paymentRef,
      });
      setIsPaymentModalOpen(false);
      setPaymentAmount("");
      setPaymentRef("");
      fetchPurchase();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (isLoading && !purchase) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
        Loading shipment details...
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Purchase #{purchaseId} not found.
      </div>
    );
  }

  const balanceNum = Number(purchase.balance) || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/${businessId}/purchases`}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              &larr; Purchases
            </Link>
            <span className="text-xs text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Shipment #{purchase.id}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Inbound Shipment #{purchase.id}
            </h1>
            <Badge
              variant={
                purchase.status === "paid"
                  ? "success"
                  : purchase.status === "partial"
                  ? "warning"
                  : "danger"
              }
            >
              {purchase.status}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Invoice: {purchase.invoice_no || "None"} &bull; Date: {formatDate(purchase.purchase_date)}
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
            + Pay Supplier Balance
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase">Vendor / Supplier</div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
              {purchase.supplier_name || "Direct Purchase"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-slate-400 uppercase">Total Bill</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatMoney(purchase.total_cost)}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              Paid: {formatMoney(purchase.amount_paid)}
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
              {formatMoney(purchase.balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items Received */}
      <Card>
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-sm font-semibold">Products Received</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 font-semibold uppercase text-[10px]">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3 text-center">Qty Received</th>
                <th className="px-5 py-3 text-right">Unit Cost</th>
                <th className="px-5 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {purchase.items?.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    {item.product_name}
                  </td>
                  <td className="px-5 py-3 text-center font-medium">+{item.quantity}</td>
                  <td className="px-5 py-3 text-right text-slate-500">
                    {formatMoney(item.unit_cost)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900 dark:text-slate-100">
                    {formatMoney(Number(item.unit_cost) * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Pay Supplier Balance"
        description={`Remaining balance: ${formatMoney(purchase.balance)}`}
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
              className="w-full h-10 px-3 py-2 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="tigopesa">Tigo Pesa</option>
              <option value="airtelmoney">Airtel Money</option>
              <option value="halopesa">HaloPesa</option>
            </select>
          </div>

          <Input
            label="Reference Note (optional)"
            placeholder="e.g. Bank slip or MPesa ref"
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

