"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Brand, Category, Product } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Icons } from "@/components/ui/Icons";

export default function ProductsPage() {
  const params = useParams();
  const businessId = Number(params.businessId);
  const { t } = useI18n();

  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    brand: "",
    category: "",
    cost_price: "",
    selling_price: "",
    stock_quantity: "",
    low_stock_threshold: "5",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restock Modal
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [isRestocking, setIsRestocking] = useState(false);

  const fetchBrandsAndCategories = () => {
    if (!businessId) return;
    Promise.all([
      api.getBrands(businessId),
      api.getCategories(businessId),
    ])
      .then(([brandRes, catRes]) => {
        setBrands(brandRes.data);
        setCategories(catRes.data);
      })
      .catch((err) => console.error("Failed to load brands/categories:", err));
  };

  useEffect(() => {
    fetchBrandsAndCategories();
  }, [businessId]);

  const fetchProducts = () => {
    if (!businessId) return;
    setIsLoading(true);

    const filterParams: any = {};
    if (selectedBrand) filterParams.brand = Number(selectedBrand);
    if (selectedCategory) filterParams.category = Number(selectedCategory);

    api.getProducts(businessId, filterParams)
      .then((prodRes) => {
        setProducts(prodRes.data);
      })
      .catch((err) => console.error("Failed to load products:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, [businessId, selectedBrand, selectedCategory]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createProduct(businessId, {
        name: newProduct.name,
        brand: newProduct.brand ? Number(newProduct.brand) : null,
        category: newProduct.category ? Number(newProduct.category) : null,
        cost_price: parseFloat(newProduct.cost_price),
        selling_price: parseFloat(newProduct.selling_price),
        stock_quantity: parseInt(newProduct.stock_quantity) || 0,
        low_stock_threshold: parseInt(newProduct.low_stock_threshold) || 5,
      });
      setIsCreateModalOpen(false);
      setNewProduct({
        name: "",
        brand: "",
        category: "",
        cost_price: "",
        selling_price: "",
        stock_quantity: "",
        low_stock_threshold: "5",
      });
      fetchProducts();
    } catch (err) {
      console.error("Create product failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct || !restockQty) return;
    setIsRestocking(true);
    try {
      await api.restockProduct(businessId, restockProduct.id, {
        quantity: parseInt(restockQty),
      });
      setRestockProduct(null);
      setRestockQty("");
      fetchProducts();
    } catch (err) {
      console.error("Restock failed:", err);
    } finally {
      setIsRestocking(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await api.deleteProduct(businessId, id);
      fetchProducts();
    } catch (err) {
      console.error("Failed to delete product:", err);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Telemetry Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-cosmic-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              Inventory Bay Registry
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
            {t("products")}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Catalog inventory levels, unit margins, and automated reorder thresholds
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          className="gap-1.5 shadow-md shadow-emerald-600/20 font-mono text-xs"
        >
          <Icons.Plus size={15} />
          <span>{t("add_product_btn")}</span>
        </Button>
      </div>

      {/* Glass Filter Console */}
      <div className="flex flex-col sm:flex-row items-center gap-3 p-1.5 rounded-2xl bg-white/40 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06] backdrop-blur-md">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Icons.Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search catalog by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-xl bg-white/80 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
          />
        </div>

        {/* Brand filter */}
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="w-full sm:w-44 h-9 px-3 text-xs rounded-xl bg-white/80 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all font-mono"
        >
          <option value="">{t("all_brands")}</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="w-full sm:w-44 h-9 px-3 text-xs rounded-xl bg-white/80 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all font-mono"
        >
          <option value="">{t("all_categories")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table Crystalline Card */}
      <Card className="border-slate-200/80 dark:border-white/[0.08] overflow-hidden shadow-xl">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-xs font-mono text-slate-400 animate-pulse">
              Querying inventory telemetry records...
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] text-slate-500 dark:text-slate-400 font-mono uppercase text-[10px] tracking-wider">
                    <th className="px-5 py-3.5">Product Name</th>
                    <th className="px-5 py-3.5">Brand / Category</th>
                    <th className="px-5 py-3.5 text-right">Cost Price</th>
                    <th className="px-5 py-3.5 text-right">Selling Price</th>
                    <th className="px-5 py-3.5 text-center">In Stock</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {filteredProducts.map((p) => {
                    const isLow = p.stock_quantity <= p.low_stock_threshold;
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-white">
                          {p.name}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          <div className="flex items-center gap-1.5">
                            {p.brand_name && <Badge size="sm" variant="neutral">{p.brand_name}</Badge>}
                            {p.category_name && <Badge size="sm" variant="info">{p.category_name}</Badge>}
                            {!p.brand_name && !p.category_name && <span className="text-slate-400 font-mono">—</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-500 dark:text-slate-400">
                          {formatMoney(p.cost_price)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatMoney(p.selling_price)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5 font-mono">
                            <span
                              className={`font-bold ${
                                isLow
                                  ? "text-rose-500 dark:text-rose-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {p.stock_quantity}
                            </span>
                            {isLow && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 font-mono">
                                LOW
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-mono"
                            onClick={() => setRestockProduct(p)}
                          >
                            + {t("restock")}
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p.id)}
                            className="text-xs text-slate-400 hover:text-rose-500 p-1 transition-colors"
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
            <div className="p-12 text-center text-xs font-mono text-slate-400">
              No inventory records found matching filters.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Product Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t("add_product_btn")}
        description="Register a new inventory product in the store database"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4">
          <Input
            label={`${t("product_name")} *`}
            placeholder="e.g. Azam Energy Drink 300ml"
            value={newProduct.name}
            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Brand Designation
              </label>
              <select
                value={newProduct.brand}
                onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                className="w-full h-10 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
              >
                <option value="">None</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Classification / Category
              </label>
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                className="w-full h-10 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`${t("cost_price")} *`}
              type="number"
              step="any"
              placeholder="e.g. 800"
              value={newProduct.cost_price}
              onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })}
              required
            />
            <Input
              label={`${t("selling_price")} *`}
              type="number"
              step="any"
              placeholder="e.g. 1200"
              value={newProduct.selling_price}
              onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`${t("stock_qty")} *`}
              type="number"
              placeholder="e.g. 50"
              value={newProduct.stock_quantity}
              onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: e.target.value })}
              required
            />
            <Input
              label={`${t("min_threshold")} *`}
              type="number"
              placeholder="e.g. 5"
              value={newProduct.low_stock_threshold}
              onChange={(e) => setNewProduct({ ...newProduct, low_stock_threshold: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {t("save_product")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Restock Modal */}
      <Modal
        isOpen={!!restockProduct}
        onClose={() => setRestockProduct(null)}
        title={`Restock: ${restockProduct?.name || ""}`}
        description="Add inventory replenishment units to bay"
      >
        <form onSubmit={handleRestockSubmit} className="space-y-4">
          <Input
            label="Replenishment Units Quantity *"
            type="number"
            min="1"
            placeholder="e.g. 50"
            value={restockQty}
            onChange={(e) => setRestockQty(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRestockProduct(null)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" isLoading={isRestocking}>
              {t("restock")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
