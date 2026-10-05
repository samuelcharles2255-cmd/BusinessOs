"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Product } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Icons } from "@/components/ui/Icons";

interface LineItem {
  productId: number;
  quantity: number;
}

export default function RecordSalePage() {
  const params = useParams();
  const router = useRouter();
  const businessId = Number(params.businessId);
  const { t } = useI18n();

  const [products, setProducts] = useState<Product[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [isAmountManuallyEdited, setIsAmountManuallyEdited] = useState(false);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (businessId) {
      api
        .getProducts(businessId)
        .then((res) => setProducts(res.data))
        .catch((err) => console.error("Failed to load products:", err));
    }
  }, [businessId]);

  // Add line item
  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const pId = Number(selectedProductId);
    const existing = lineItems.find((i) => i.productId === pId);
    if (existing) {
      setLineItems(
        lineItems.map((i) =>
          i.productId === pId ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setLineItems([...lineItems, { productId: pId, quantity: 1 }]);
    }
    setSelectedProductId("");
  };

  const handleUpdateQty = (productId: number, qty: number) => {
    if (qty <= 0) {
      setLineItems(lineItems.filter((i) => i.productId !== productId));
    } else {
      setLineItems(
        lineItems.map((i) =>
          i.productId === productId ? { ...i, quantity: qty } : i
        )
      );
    }
  };

  // Calculations
  const calculatedTotal = lineItems.reduce((acc, item) => {
    const prod = products.find((p) => p.id === item.productId);
    const price = prod ? Number(prod.selling_price) : 0;
    return acc + price * item.quantity;
  }, 0);

  const numReceived = parseFloat(amountReceived) || 0;
  const hasDebt = numReceived < calculatedTotal;
  const balanceDue = hasDebt ? calculatedTotal - numReceived : 0;
  const changeToReturn = !hasDebt && numReceived > calculatedTotal ? numReceived - calculatedTotal : 0;

  // Auto-fill amount received with total on line items change unless manually edited
  useEffect(() => {
    if (!isAmountManuallyEdited && calculatedTotal > 0) {
      setAmountReceived(String(calculatedTotal));
    }
  }, [calculatedTotal, isAmountManuallyEdited]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      setError("Please add at least one product to the sale.");
      return;
    }

    if (hasDebt && (!customerName.trim() || !customerPhone.trim())) {
      setError("Customer name and phone number are required when recording a balance/debt.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await api.recordSale(businessId, {
        items: lineItems.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
        payment_method: paymentMethod,
        amount_received: numReceived,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
      });

      router.push(`/${businessId}/sales/${res.data.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to record sale. Check stock and inputs.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const paymentMethods = [
    { id: "cash", label: t("cash") },
    { id: "mpesa", label: "M-Pesa" },
    { id: "tigopesa", label: "Tigo Pesa" },
    { id: "airtelmoney", label: "Airtel Money" },
    { id: "halopesa", label: "HaloPesa" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Console Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-cosmic-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              POS Terminal Console
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            {t("pos_title")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time retail counter transaction with instant ledger synchronization
          </p>
        </div>
        <Link href={`/${businessId}/sales`}>
          <Button variant="outline" size="sm" className="gap-1.5 font-mono text-xs">
            <Icons.ShoppingBag size={14} />
            <span>{t("sales_history")}</span>
          </Button>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2.5">
          <Icons.AlertTriangle size={18} className="shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Cart Line Items & Fast Selector */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200/80 dark:border-white/[0.08]">
            <CardHeader className="py-3.5 px-5 border-b border-slate-100 dark:border-white/[0.06] flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Icons.Layers size={14} className="text-cyan-500" />
                <span>Line Items Manifest</span>
              </CardTitle>
              <span className="text-[11px] font-mono text-slate-400">
                {lineItems.length} {lineItems.length === 1 ? "item" : "items"}
              </span>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              {/* Product Fast Selector */}
              <div className="flex gap-2">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="flex-1 h-10 px-3 py-2 text-xs font-medium rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                >
                  <option value="">{t("select_product")}...</option>
                  {products.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={p.stock_quantity <= 0}
                    >
                      {p.name} — TZS {Number(p.selling_price).toLocaleString()} ({p.stock_quantity} available)
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={!selectedProductId}
                  className="gap-1.5 shrink-0 px-4"
                >
                  <Icons.Plus size={15} />
                  <span>Add Line</span>
                </Button>
              </div>

              {/* Items List */}
              {lineItems.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-white/[0.06] border border-slate-100 dark:border-white/[0.06] rounded-xl overflow-hidden bg-slate-50/40 dark:bg-white/[0.02]">
                  <AnimatePresence initial={false}>
                    {lineItems.map((item) => {
                      const prod = products.find((p) => p.id === item.productId);
                      if (!prod) return null;
                      const itemSubtotal = Number(prod.selling_price) * item.quantity;
                      const isExceedingStock = item.quantity > prod.stock_quantity;

                      return (
                        <motion.div
                          key={item.productId}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                              {prod.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              TZS {Number(prod.selling_price).toLocaleString()} &times; {item.quantity}
                            </div>
                            {isExceedingStock && (
                              <span className="text-[10px] text-rose-500 font-medium font-mono">
                                Alert: only {prod.stock_quantity} units in bay
                              </span>
                            )}
                          </div>

                          {/* Qty Stepper */}
                          <div className="flex items-center gap-1 bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.08] rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.productId, item.quantity - 1)}
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.1] transition-colors text-xs font-bold"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateQty(item.productId, parseInt(e.target.value) || 1)
                              }
                              className="w-10 h-6 text-center text-xs font-mono font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.productId, item.quantity + 1)}
                              className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.1] transition-colors text-xs font-bold"
                            >
                              +
                            </button>
                          </div>

                          {/* Subtotal & Delete */}
                          <div className="text-right min-w-[95px]">
                            <div className="text-xs font-bold font-mono text-slate-900 dark:text-white">
                              {formatMoney(itemSubtotal)}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(item.productId, 0)}
                              className="text-[10px] text-rose-500 hover:text-rose-400 hover:underline mt-0.5 font-mono"
                            >
                              Delete
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl bg-slate-50/50 dark:bg-white/[0.01]">
                  <Icons.ShoppingCart size={28} className="mx-auto text-slate-400 opacity-40" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Terminal tray empty &middot; Select a catalog item above
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Checkout Telemetry & Settlement */}
        <div className="space-y-4">
          <Card className="border-cyan-500/20 dark:border-cyan-500/20 shadow-xl overflow-hidden">
            {/* Specular laser header */}
            <CardHeader className="py-3.5 px-5 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-transparent border-b border-cyan-500/10">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-emerald-600 dark:text-cyan-400 flex items-center gap-2">
                <Icons.TrendingUp size={14} />
                <span>Settlement Telemetry</span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              {/* Grand Total Telemetry Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] text-center relative overflow-hidden">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  Total Payable
                </span>
                <div className="text-3xl font-black font-mono tracking-tight text-emerald-600 dark:text-cyan-400 mt-1 drop-shadow-[0_0_12px_rgba(6,182,212,0.25)]">
                  {formatMoney(calculatedTotal)}
                </div>
              </div>

              {/* Payment Channel */}
              <div className="space-y-2">
                <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("payment_method")}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {paymentMethods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                        paymentMethod === m.id
                          ? "bg-cyan-500/10 dark:bg-cyan-500/20 border-cyan-500/50 text-cyan-600 dark:text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                          : "bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tendered Amount */}
              <Input
                label={t("amount_received")}
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={amountReceived}
                onChange={(e) => {
                  setIsAmountManuallyEdited(true);
                  setAmountReceived(e.target.value);
                }}
                required
              />

              {/* Change or Debt Alert Box */}
              {changeToReturn > 0 && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex justify-between items-center text-emerald-600 dark:text-emerald-300 font-mono font-bold">
                  <span>{t("change_return")}:</span>
                  <span className="text-sm">{formatMoney(changeToReturn)}</span>
                </div>
              )}

              {hasDebt && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1.5">
                  <div className="flex justify-between font-mono font-bold">
                    <span>{t("balance_owed")}:</span>
                    <span className="text-sm text-amber-500">{formatMoney(balanceDue)}</span>
                  </div>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400/90 leading-tight">
                    Customer ledger entry will be created. Contact coordinates mandatory.
                  </p>
                </div>
              )}

              {/* Customer Coordinates */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
                <Input
                  label={`${t("customer_name")} ${hasDebt ? "*" : "(optional)"}`}
                  placeholder="e.g. Juma Ali"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required={hasDebt}
                />
                <Input
                  label={`${t("customer_phone")} ${hasDebt ? "*" : "(optional)"}`}
                  placeholder="e.g. 0712345678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required={hasDebt}
                />
              </div>

              {/* Authorize Transaction Button */}
              <Button
                type="submit"
                className="w-full mt-2 font-semibold shadow-lg shadow-emerald-600/20 text-sm"
                size="lg"
                isLoading={isLoading}
                disabled={lineItems.length === 0}
              >
                {t("complete_sale")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
