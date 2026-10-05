"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Icons } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export function Topbar({ onOpenMobileMenu }: TopbarProps) {
  const { user, logout, activeBusinessId, businesses } = useAuth();
  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme } = useTheme();

  const biz = businesses.find((b) => b.id === activeBusinessId);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-slate-200/80 dark:border-white/[0.06] bg-white/70 dark:bg-[#03060f]/75 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between transition-colors">
      {/* Left side: Mobile menu toggle + breadcrumb telemetry */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white/10 transition-colors"
          aria-label="Toggle navigation drawer"
        >
          <Icons.Menu size={20} />
        </button>

        {biz && (
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-cosmic-pulse" />
            <span className="text-slate-900 dark:text-slate-100 font-semibold tracking-tight">{biz.name}</span>
          </div>
        )}
      </div>

      {/* Right side: Language, Theme toggle, Quick POS, User avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick New Sale button (Desktop) */}
        {activeBusinessId && (
          <Link
            href={`/${activeBusinessId}/sales/new`}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm shadow-emerald-600/20 hover:shadow-emerald-500/30 transition-all active:scale-95"
          >
            <Icons.Plus size={14} />
            <span>{t("record_sale")}</span>
          </Link>
        )}

        {/* Language Switcher */}
        <div className="flex items-center rounded-lg border border-slate-200 dark:border-white/[0.08] p-0.5 bg-slate-100/80 dark:bg-white/[0.04] text-xs font-semibold backdrop-blur-xs">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-2 py-0.5 rounded-md text-[11px] transition-all ${
              lang === "en"
                ? "bg-white dark:bg-white/[0.12] text-emerald-600 dark:text-cyan-400 shadow-2xs font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang("sw")}
            className={`px-2 py-0.5 rounded-md text-[11px] transition-all ${
              lang === "sw"
                ? "bg-white dark:bg-white/[0.12] text-emerald-600 dark:text-cyan-400 shadow-2xs font-bold"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            SW
          </button>
        </div>

        {/* Working Light/Dark Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Celestial Light Mode" : "Switch to Deep Space Void Mode"}
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-transparent hover:border-slate-200 dark:hover:border-white/[0.08] transition-all duration-200 group active:scale-90"
        >
          <div className="relative w-4 h-4 flex items-center justify-center">
            {theme === "dark" ? (
              <span className="text-amber-400 transform group-hover:rotate-45 transition-transform duration-300">
                <Icons.Sun size={16} />
              </span>
            ) : (
              <span className="text-indigo-600 transform group-hover:-rotate-12 transition-transform duration-300">
                <Icons.Moon size={16} />
              </span>
            )}
          </div>
        </button>

        {/* User Info & Logout */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-white/[0.08]">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 font-bold text-xs flex items-center justify-center select-none shadow-xs">
              {user.username.slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden md:inline-block text-xs font-mono text-slate-700 dark:text-slate-300 max-w-[100px] truncate">
              {user.username}
            </span>
            <button
              type="button"
              onClick={logout}
              title={t("sign_out")}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <Icons.LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link href="/login">
            <Button size="sm">{t("sign_in")}</Button>
          </Link>
        )}
      </div>
    </header>
  );
}
