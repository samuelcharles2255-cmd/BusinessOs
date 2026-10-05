"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Icons } from "@/components/ui/Icons";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();

  const [form, setForm] = useState({
    username: "",
    phone: "",
    email: "",
    password: "",
    business_name: "",
    business_location: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.phone || !form.password || !form.business_name) {
      setError("Please fill in all required fields (username, phone, password, business name).");
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.register(form);
      localStorage.setItem("biashara_access_token", res.data.access);
      localStorage.setItem("biashara_refresh_token", res.data.refresh);
      localStorage.setItem("biashara_active_biz", String(res.data.business_id));
      router.push(`/${res.data.business_id}/dashboard`);
    } catch (err: any) {
      const data = err.response?.data;
      if (typeof data === "object") {
        const firstKey = Object.keys(data)[0];
        const val = data[firstKey];
        setError(`${firstKey}: ${Array.isArray(val) ? val[0] : val}`);
      } else {
        setError("Failed to register. Please check your information and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-indigo-500/20 border border-white/10 text-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.15)] mb-1">
          <Icons.Store size={26} className="text-emerald-500 dark:text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Initialize Biashara OS
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Set up your commercial profile and launch your inventory terminal
        </p>
      </div>

      <Card className="border-slate-200/80 dark:border-white/[0.08] shadow-2xl backdrop-blur-2xl">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2.5">
                <Icons.AlertTriangle size={16} className="shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Store Information */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-cosmic-pulse" />
                <span>Enterprise Registry</span>
              </div>
              <Input
                label="Commercial Entity / Business Name *"
                name="business_name"
                placeholder="e.g. Mama Neema Duka"
                value={form.business_name}
                onChange={handleChange}
                required
              />
              <Input
                label="Store Physical Location"
                name="business_location"
                placeholder="e.g. Kariakoo, Dar es Salaam"
                value={form.business_location}
                onChange={handleChange}
              />
            </div>

            {/* Operator Account */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <span>Operator Credentials</span>
              </div>
              <Input
                label="Username / Call-Sign *"
                name="username"
                placeholder="e.g. neema"
                value={form.username}
                onChange={handleChange}
                required
              />
              <Input
                label="Telephone Access Number *"
                name="phone"
                placeholder="e.g. 0712345678"
                value={form.phone}
                onChange={handleChange}
                required
              />
              <Input
                label="Email Transmission (optional)"
                name="email"
                type="email"
                placeholder="owner@example.com"
                value={form.email}
                onChange={handleChange}
              />
              <Input
                label="Master Security Password *"
                name="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full mt-3 font-semibold shadow-lg shadow-emerald-600/20"
              size="lg"
              isLoading={isLoading}
            >
              {t("register")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-slate-500 dark:text-slate-400">
        Already registered in the system?{" "}
        <Link
          href="/login"
          className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline"
        >
          Access Terminal
        </Link>
      </div>
    </div>
  );
}
