"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Icons } from "@/components/ui/Icons";

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useI18n();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter your username/phone and password.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await login({ username: username.trim(), password });
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        "Invalid username, email, or password. Please try again.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-indigo-500/20 border border-white/10 text-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.15)] mb-1">
          <Icons.Store size={26} className="text-emerald-500 dark:text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Welcome to Biashara OS
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Enter your terminal credentials to access your store telemetry
        </p>
      </div>

      {/* Login Crystalline Card */}
      <Card className="border-slate-200/80 dark:border-white/[0.08] shadow-2xl backdrop-blur-2xl">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2.5">
                <Icons.AlertTriangle size={16} className="shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <Input
              label="Operator Identifier (Username / Phone / Email)"
              placeholder="e.g. 0712345678 or samuel"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />

            <Input
              label="Access Key / Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <Button
              type="submit"
              className="w-full mt-2 font-semibold shadow-lg shadow-emerald-600/20"
              size="lg"
              isLoading={isLoading}
            >
              {t("sign_in")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Registration link */}
      <div className="text-center text-xs text-slate-500 dark:text-slate-400">
        Don&apos;t have a registered business?{" "}
        <Link
          href="/register"
          className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline"
        >
          Initialize Store Profile
        </Link>
      </div>
    </div>
  );
}
