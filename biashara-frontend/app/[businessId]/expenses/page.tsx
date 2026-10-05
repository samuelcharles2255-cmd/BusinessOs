"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Expense } from "@/lib/types";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icons } from "@/components/ui/Icons";

export default function ExpensesPage() {
  const params = useParams();
  const businessId = Number(params.businessId);
  const { t } = useI18n();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Add Expense modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchExpenses = () => {
    if (!businessId) return;
    setIsLoading(true);
    api
      .getExpenses(businessId)
      .then((res) => setExpenses(res.data))
      .catch((err) => console.error("Failed to load expenses:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchExpenses();
  }, [businessId]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;
    setIsSubmitting(true);
    try {
      await api.createExpense(businessId, {
        description: description.trim(),
        category: category.trim(),
        amount: parseFloat(amount),
        date,
      });
      setIsModalOpen(false);
      setDescription("");
      setAmount("");
      fetchExpenses();
    } catch (err) {
      console.error("Create expense failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    try {
      await api.deleteExpense(businessId, id);
      fetchExpenses();
    } catch (err) {
      console.error("Delete expense failed:", err);
    }
  };

  const totalExpense = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  const filtered = expenses.filter(
    (e) =>
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("expenses")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Total recorded expenses:{" "}
            <span className="font-bold text-red-600 dark:text-red-400">
              {formatMoney(totalExpense)}
            </span>
          </p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5 shadow-sm">
          <Icons.Receipt size={15} />
          <span>{t("add_expense")}</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Icons.Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search expenses by note or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Expenses Table Card */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
              Loading expense records...
            </div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="px-5 py-3">{t("description")}</th>
                    <th className="px-5 py-3">{t("category")}</th>
                    <th className="px-5 py-3">{t("date")}</th>
                    <th className="px-5 py-3 text-right">{t("amount")}</th>
                    <th className="px-5 py-3 text-right">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                        {e.description}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge size="sm" variant="neutral">{e.category || "General"}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono">
                        {formatDate(e.date)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-red-600 dark:text-red-400">
                        -{formatMoney(e.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(e.id)}
                          className="text-xs text-red-500 hover:text-red-700 p-1"
                          title={t("delete")}
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              No expenses recorded yet.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("add_expense")}
        description="Log an operational cost, transport, electricity or store overhead"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <Input
            label="Description *"
            placeholder="e.g. Electricity bill (LUKU) or Transport"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="General">General</option>
                <option value="Utilities">Utilities (Electricity/Water)</option>
                <option value="Rent">Store Rent</option>
                <option value="Transport">Transport & Delivery</option>
                <option value="Packaging">Packaging</option>
                <option value="Salaries">Staff Wages</option>
              </select>
            </div>

            <Input
              label="Amount (TZS) *"
              type="number"
              step="any"
              min="1"
              placeholder="e.g. 25000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <Input
            label="Date *"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
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

