"use client";

import React from "react";
import Link from "next/link";
import { CosmicBackground } from "@/components/layout/CosmicBackground";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useI18n } from "@/lib/i18n";
import { Icons } from "@/components/ui/Icons";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useI18n();

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Interstellar background & particle stardust */}
      <CosmicBackground />

      {/* Floating navigation bar with brand, lang & theme switcher */}
      <header className="relative z-20 w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-200">
            <Icons.Store size={18} />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-sm font-bold tracking-wider text-slate-900 dark:text-white uppercase">
              Biashara<span className="text-cyan-600 dark:text-cyan-400">OS</span>
            </span>
            <span className="text-[9px] font-mono tracking-widest text-slate-400 dark:text-slate-500 uppercase -mt-0.5">
              Operating System
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2.5">
          {/* Language Switcher */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-white/[0.08] p-0.5 bg-white/70 dark:bg-white/[0.04] backdrop-blur-md text-xs font-semibold">
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

          {/* Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to Celestial Light Mode" : "Switch to Deep Space Void Mode"}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-white/70 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] backdrop-blur-md transition-all duration-200 group active:scale-90"
            aria-label="Toggle theme"
          >
            <div className="w-4 h-4 flex items-center justify-center">
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
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>

      {/* Cosmic telemetry footer */}
      <footer className="relative z-10 py-4 text-center text-[11px] font-mono text-slate-400 dark:text-slate-600">
        Biashara OS &middot; Next-Gen Retail &amp; Inventory Engine &middot; Secured with JWT
      </footer>
    </div>
  );
}

