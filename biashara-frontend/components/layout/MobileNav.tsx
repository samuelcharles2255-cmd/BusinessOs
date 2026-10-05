"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Icons } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { activeBusinessId } = useAuth();
  const { t } = useI18n();

  const bizId = activeBusinessId || 1;

  const navItems = [
    {
      name: t("dashboard"),
      href: `/${bizId}/dashboard`,
      icon: Icons.Dashboard,
    },
    {
      name: t("products"),
      href: `/${bizId}/products`,
      icon: Icons.Package,
    },
    {
      name: t("record_sale"),
      href: `/${bizId}/sales/new`,
      icon: Icons.Plus,
      isFab: true,
    },
    {
      name: t("customers"),
      href: `/${bizId}/customers`,
      icon: Icons.Users,
    },
    {
      name: t("ai_assistant"),
      href: `/${bizId}/assistant`,
      icon: Icons.Bot,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 dark:bg-[#0b0f19]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 px-2 flex items-center justify-around lg:hidden">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        if (item.isFab) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center -mt-5"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex items-center justify-center transition-transform active:scale-95">
                <Icon size={24} />
              </div>
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                {item.name}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors",
              isActive
                ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            )}
          >
            <Icon size={18} />
            <span className="text-[10px] tracking-tight mt-1">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

