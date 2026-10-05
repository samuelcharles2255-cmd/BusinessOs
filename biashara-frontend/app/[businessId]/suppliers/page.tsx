"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Supplier } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icons } from "@/components/ui/Icons";

export default function SuppliersPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const businessId = Number(params.businessId);
  const { t } = useI18n();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filterOwed, setFilterOwed] = useState(searchParams.get("filter") === "owed");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Add Supplier modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchSuppliers = () => {
    if (!businessId) return;
    setIsLoading(true);
    api
      .getSuppliers(businessId, filterOwed ? "owed" : undefined)
      .then((res) => setSuppliers(res.data))
      .catch((err) => console.error("Failed to load suppliers:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchSuppliers();
  }, [businessId, filterOwed]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.createSupplier(businessId, { name: name.trim(), phone: phone.trim() });
      setIsModalOpen(false);
      setName("");
      setPhone("");
      fetchSuppliers();
    } catch (err: any) {
      const msg = err.response?.data?.phone?.[0] || err.response?.data?.detail || "Failed to create supplier.";
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this supplier?")) return;
    try {
      await api.deleteSupplier(businessId, id);
      fetchSuppliers();
    } catch (err) {
      console.error("Delete supplier failed:", err);
    }
  };

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone && s.phone.includes(search))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("suppliers")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Vendor contacts and outstanding supplier payments
          </p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5 shadow-sm">
          <Icons.Truck size={15} />
          <span>{t("add_supplier")}</span>
        </Button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Icons.Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by vendor name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant={filterOwed ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilterOwed(!filterOwed)}
            className="text-xs"
          >
            {filterOwed ? t("show_all") : t("filter_owed")}
          </Button>
        </div>
      </div>

      {/* Suppliers Table Card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
              Loading suppliers...
            </div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="px-5 py-3">Vendor / Company</th>
                    <th className="px-5 py-3">{t("phone_number")}</th>
                    <th className="px-5 py-3 text-right">Owed Balance</th>
                    <th className="px-5 py-3 text-right">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((s) => {
                    const owed = Number(s.balance_owed) || 0;
                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                          {s.name}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-mono">
                          {s.phone || "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold">
                          {owed > 0 ? (
                            <Badge variant="danger">{formatMoney(owed)}</Badge>
                          ) : (
                            <span className="text-slate-400">0.00</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            className="text-xs text-red-500 hover:text-red-700 p-1"
                            title={t("delete")}
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              No suppliers found matching search.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("add_supplier")}
        description="Register a wholesale vendor or supplier contact"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs">
              {modalError}
            </div>
          )}
          <Input
            label="Vendor / Business Name *"
            placeholder="e.g. Bakhresa Group"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label={t("phone_number")}
            placeholder="e.g. 0754321111"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {t("save")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

