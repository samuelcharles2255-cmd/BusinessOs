"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BusinessStaff } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icons } from "@/components/ui/Icons";

export default function StaffPage() {
  const params = useParams();
  const businessId = Number(params.businessId);
  const { t } = useI18n();

  const [staff, setStaff] = useState<BusinessStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({
    username: "",
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "seller",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchStaff = () => {
    if (!businessId) return;
    setIsLoading(true);
    api
      .getStaff(businessId)
      .then((res) => setStaff(res.data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchStaff();
  }, [businessId]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.addStaff(businessId, newStaff);
      setIsModalOpen(false);
      setNewStaff({
        username: "",
        name: "",
        email: "",
        password: "",
        phone: "",
        role: "seller",
      });
      fetchStaff();
    } catch (err: any) {
      const msg =
        err.response?.data?.username?.[0] ||
        err.response?.data?.phone?.[0] ||
        err.response?.data?.detail ||
        "Failed to add staff member.";
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStaff = async (id: number) => {
    if (!confirm("Are you sure you want to remove this staff member from your store?")) return;
    try {
      await api.deleteStaff(businessId, id);
      fetchStaff();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("staff")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Store sellers and operators with point-of-sale terminal access
          </p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5 shadow-sm">
          <Icons.UserPlus size={15} />
          <span>{t("add_staff")}</span>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading staff...</div>
          ) : staff.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {staff.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-slate-300">
                      {s.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{s.name || s.username}</span>
                        <Badge size="sm" variant={s.role === "owner" ? "success" : "neutral"}>
                          {s.role}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        @{s.username} &bull; {s.phone || "No phone"}
                      </div>
                    </div>
                  </div>
                  {s.role !== "owner" && (
                    <button
                      type="button"
                      onClick={() => handleDeleteStaff(s.id)}
                      className="text-xs text-red-500 hover:text-red-700 p-1"
                      title={t("delete")}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">No staff added yet.</div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("add_staff")}
        description="Grant counter POS access to an employee or partner"
      >
        <form onSubmit={handleCreateStaff} className="space-y-3">
          {modalError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs">
              {modalError}
            </div>
          )}
          <Input
            label="Full Name *"
            placeholder="e.g. John Peter"
            value={newStaff.name}
            onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
            required
            autoFocus
          />
          <Input
            label="Login Username *"
            placeholder="e.g. john"
            value={newStaff.username}
            onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })}
            required
          />
          <Input
            label="Phone Number *"
            placeholder="e.g. 0712345678"
            value={newStaff.phone}
            onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
            required
          />
          <Input
            label="Password *"
            type="password"
            placeholder="••••••••"
            value={newStaff.password}
            onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
            required
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase">
              Role
            </label>
            <select
              value={newStaff.role}
              onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
              className="w-full h-10 px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <option value="seller">Seller (Counter POS only)</option>
              <option value="owner">Owner (Full admin rights)</option>
            </select>
          </div>

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

