"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Business } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function SettingsPage() {
  const params = useParams();
  const businessId = Number(params.businessId);
  const { lang, setLang, t } = useI18n();

  const [business, setBusiness] = useState<Business | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!businessId) return;
    setIsLoading(true);
    api
      .getBusiness(businessId)
      .then((res) => {
        setBusiness(res.data);
        setName(res.data.name);
        setLocation(res.data.location || "");
        setPhone(res.data.phone || "");
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, [businessId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);
    try {
      await api.updateBusiness(businessId, { name, location, phone });
      setStatusMsg("Business profile updated successfully.");
    } catch (err) {
      console.error(err);
      setStatusMsg("Failed to update settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t("settings")}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Store profile details and interface preferences
        </p>
      </div>

      <Card>
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-sm font-semibold">Store Profile</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading settings...</div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              {statusMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 text-xs">
                  {statusMsg}
                </div>
              )}
              <Input
                label="Store Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Location / Branch"
                placeholder="e.g. Mlimani City, Dar es Salaam"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <Input
                label="Contact Phone"
                placeholder="e.g. 0712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <div className="pt-2">
                <Button type="submit" isLoading={isSaving}>
                  {t("save")} Changes
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-sm font-semibold">Language / Lugha</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-3">
          <p className="text-xs text-slate-500">
            Choose your preferred language for POS buttons, labels, and receipts:
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={lang === "en" ? "primary" : "outline"}
              size="sm"
              onClick={() => setLang("en")}
            >
              English
            </Button>
            <Button
              type="button"
              variant={lang === "sw" ? "primary" : "outline"}
              size="sm"
              onClick={() => setLang("sw")}
            >
              Kiswahili
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

