"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Brand } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icons } from "@/components/ui/Icons";

export default function BrandsPage() {
  const params = useParams();
  const businessId = Number(params.businessId);
  const { t } = useI18n();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchBrands = () => {
    if (!businessId) return;
    setIsLoading(true);
    api
      .getBrands(businessId)
      .then((res) => setBrands(res.data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchBrands();
  }, [businessId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await api.createBrand(businessId, name.trim());
      setIsModalOpen(false);
      setName("");
      fetchBrands();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this brand?")) return;
    try {
      await api.deleteBrand(businessId, id);
      fetchBrands();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t("brands")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Product brands and manufacturer labels for catalog filtering
          </p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5 shadow-sm">
          <Icons.Plus size={15} />
          <span>Add Brand</span>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading brands...</div>
          ) : brands.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {brands.map((b) => (
                <div key={b.id} className="px-5 py-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{b.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(b.id)}
                    className="text-xs text-red-500 hover:text-red-700 p-1"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">No brands created yet.</div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Brand"
        description="Add a new brand name to your store"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Brand Name *"
            placeholder="e.g. Azam, Bakhresa, Unilever"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
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

