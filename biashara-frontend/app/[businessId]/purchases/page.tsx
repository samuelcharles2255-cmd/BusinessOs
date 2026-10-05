"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { PurchaseListItem, Supplier, Product } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icons } from "@/components/ui/Icons";

export default function PurchasesPage() {
  const params = useParams();
  const businessId = Number(params.businessId);
  const { t } = useI18n();

  const [purchases, setPurchases] = useState<PurchaseListItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Purchase modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<Array<{ product_id: number; quantity: number; unit_cost: number }>>([]);
  const [selectedProd, setSelectedProd] = useState("");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPurchases = () => {
    if (!businessId) return;
    setIsLoading(true);
    Promise.all([
      api.getPurchases(businessId),
      api.getSuppliers(businessId),
      api.getProducts(businessId),
    ])
      .then(([purchRes, suppRes, prodRes]) => {
        setPurchases(purchRes.data.results || []);
        setSuppliers(suppRes.data);
        setProducts(prodRes.data);
      })
      .catch((err) => console.error("Failed to load purchases:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchPurchases();
  }, [businessId]);

  const handleAddItem = () => {
    if (!selectedProd || !qty || !unitCost) return;
    setItems([
      ...items,
      {
        product_id: Number(selectedProd),
        quantity: parseInt(qty),
        unit_cost: parseFloat(unitCost),
      },
    ]);
    setSelectedProd("");
    setQty("1");
    setUnitCost("");
  };

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setIsSubmitting(true);
    try {
      await api.recordPurchase(businessId, {
        items,
        supplier_id: supplierId ? Number(supplierId) : null,
        invoice_no: invoiceNo,
        purchase_date: purchaseDate,
        amount_paid: parseFloat(amountPaid) || 0,
        payment_method: paymentMethod,
      });
      setIsModalOpen(false);
      setItems([]);
      setInvoiceNo("");
      setAmountPaid("");
      fetchPurchases();
    } catch (err) {
      console.error("Create purchase failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("purchases")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Inbound inventory shipments, purchase invoices, and vendor payables
          </p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5 shadow-sm">
          <Icons.Plus size={15} />
          <span>{t("receive_stock")}</span>
        </Button>
      </div>

      {/* Purchases Table Card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
              Loading inbound shipments...
            </div>
          ) : purchases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="px-5 py-3">Purchase ID</th>
                    <th className="px-5 py-3">Supplier</th>
                    <th className="px-5 py-3">Invoice #</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Total Cost</th>
                    <th className="px-5 py-3 text-right">Balance Due</th>
                    <th className="px-5 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {purchases.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                        <Link href={`/${businessId}/purchases/${p.id}`} className="hover:underline">
                          #{p.id}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                        {p.supplier_name || "Direct / Cash Purchase"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono">
                        {p.invoice_no || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono">
                        {formatDate(p.purchase_date)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatMoney(p.total_cost)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-red-600 dark:text-red-400">
                        {Number(p.balance) > 0 ? formatMoney(p.balance) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge
                          size="sm"
                          variant={
                            p.status === "paid"
                              ? "success"
                              : p.status === "partial"
                              ? "warning"
                              : "danger"
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              No inbound purchases recorded yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receive Stock / Record Purchase Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("receive_stock")}
        description="Receive stock from supplier and auto-increment product quantities"
        maxWidth="lg"
      >
        <form onSubmit={handleCreatePurchase} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase">
                Supplier (optional)
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full h-10 px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="">None / Cash vendor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <Input
              label="Invoice Number (optional)"
              placeholder="e.g. INV-2026-001"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
          </div>

          <Input
            label="Purchase Date *"
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            required
          />

          {/* Add Item Row */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Add Products to Order
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select
                value={selectedProd}
                onChange={(e) => {
                  setSelectedProd(e.target.value);
                  const p = products.find((x) => x.id === Number(e.target.value));
                  if (p) setUnitCost(String(p.cost_price));
                }}
                className="sm:col-span-2 h-9 px-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="">Select product...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="h-9 px-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Unit Cost"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="h-9 px-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              disabled={!selectedProd || !qty || !unitCost}
            >
              + Add Item
            </Button>
          </div>

          {/* Items Preview */}
          {items.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-lg p-2 text-xs">
              {items.map((it, idx) => {
                const p = products.find((x) => x.id === it.product_id);
                return (
                  <div key={idx} className="py-1.5 flex justify-between items-center">
                    <span>{it.quantity}x {p?.name}</span>
                    <span className="font-semibold">{formatMoney(it.quantity * it.unit_cost)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Input
              label="Amount Paid Now"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="tigopesa">Tigo Pesa</option>
                <option value="airtelmoney">Airtel Money</option>
                <option value="halopesa">HaloPesa</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={items.length === 0}>
              Receive Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

