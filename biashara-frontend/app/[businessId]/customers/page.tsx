"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Customer } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icons } from "@/components/ui/Icons";

export default function CustomersPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const businessId = Number(params.businessId);
  const { t } = useI18n();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filterDebtors, setFilterDebtors] = useState(searchParams.get("filter") === "debt");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Add Customer modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchCustomers = () => {
    if (!businessId) return;
    setIsLoading(true);
    api
      .getCustomers(businessId, filterDebtors ? "debt" : undefined)
      .then((res) => setCustomers(res.data))
      .catch((err) => console.error("Failed to load customers:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchCustomers();
  }, [businessId, filterDebtors]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.createCustomer(businessId, { name: name.trim(), phone: phone.trim() });
      setIsModalOpen(false);
      setName("");
      setPhone("");
      fetchCustomers();
    } catch (err: any) {
      const msg = err.response?.data?.phone?.[0] || err.response?.data?.detail || "Failed to create customer.";
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await api.deleteCustomer(businessId, id);
      fetchCustomers();
    } catch (err) {
      console.error("Delete customer failed:", err);
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("customers")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Store patrons, phone directory, and debt balances
          </p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5 shadow-sm">
          <Icons.UserPlus size={15} />
          <span>{t("add_customer")}</span>
        </Button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Icons.Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant={filterDebtors ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilterDebtors(!filterDebtors)}
            className="text-xs"
          >
            {filterDebtors ? t("show_all") : t("filter_debtors")}
          </Button>
        </div>
      </div>

      {/* Customers Table Card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
              Loading customers...
            </div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="px-5 py-3">{t("full_name")}</th>
                    <th className="px-5 py-3">{t("phone_number")}</th>
                    <th className="px-5 py-3 text-right">Balance Owed</th>
                    <th className="px-5 py-3 text-right">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((c) => {
                    const owes = Number(c.balance_owed) || 0;
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                          {c.name}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 font-mono">
                          {c.phone || "—"}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold">
                          {owes > 0 ? (
                            <Badge variant="warning">{formatMoney(owes)}</Badge>
                          ) : (
                            <span className="text-slate-400">0.00</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id)}
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
              No customers found matching search.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Customer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("add_customer")}
        description="Register a new customer for store debt and sales records"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs">
              {modalError}
            </div>
          )}
          <Input
            label={`${t("full_name")} *`}
            placeholder="e.g. Halima Said"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label={t("phone_number")}
            placeholder="e.g. 0712345678"
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

