"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Icons } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { activeBusinessId, businesses } = useAuth();
  const { t } = useI18n();

  const bizId = activeBusinessId || 1;

  const navSections = [
    {
      title: t("overview"),
      items: [
        {
          name: t("dashboard"),
          href: `/${bizId}/dashboard`,
          icon: Icons.Dashboard,
        },
        {
          name: t("ai_assistant"),
          href: `/${bizId}/assistant`,
          icon: Icons.Bot,
        },
      ],
    },
    {
      title: t("sales_orders"),
      items: [
        {
          name: t("record_sale"),
          href: `/${bizId}/sales/new`,
          icon: Icons.ShoppingCart,
        },
        {
          name: t("sales_history"),
          href: `/${bizId}/sales`,
          icon: Icons.FileText,
        },
      ],
    },
    {
      title: t("inventory_stock"),
      items: [
        {
          name: t("products"),
          href: `/${bizId}/products`,
          icon: Icons.Package,
        },
        {
          name: t("purchases"),
          href: `/${bizId}/purchases`,
          icon: Icons.Truck,
        },
        {
          name: t("brands"),
          href: `/${bizId}/brands`,
          icon: Icons.Tag,
        },
        {
          name: t("categories"),
          href: `/${bizId}/categories`,
          icon: Icons.List,
        },
      ],
    },
    {
      title: t("people_debt"),
      items: [
        {
          name: t("customers"),
          href: `/${bizId}/customers`,
          icon: Icons.Users,
        },
        {
          name: t("suppliers"),
          href: `/${bizId}/suppliers`,
          icon: Icons.Truck,
        },
        {
          name: t("staff"),
          href: `/${bizId}/staff`,
          icon: Icons.UserPlus,
        },
      ],
    },
    {
      title: t("finance"),
      items: [
        {
          name: t("expenses"),
          href: `/${bizId}/expenses`,
          icon: Icons.Receipt,
        },
      ],
    },
    {
      title: t("settings"),
      items: [
        {
          name: t("settings"),
          href: `/${bizId}/settings`,
          icon: Icons.Settings,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#03060f]/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-40 w-64 border-r transition-transform duration-250 ease-out lg:translate-x-0 flex flex-col",
          "bg-white/80 dark:bg-[#040814]/85 backdrop-blur-2xl border-slate-200/80 dark:border-white/[0.06] shadow-xl",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header: App Brand + Active Store Telemetry */}
        <div className="p-4 border-b border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Icons.Store size={18} />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping opacity-75" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Biashara</span>
                <span className="text-[10px] px-1 py-0.2 rounded font-mono bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  OS
                </span>
              </div>
              {businesses.length > 0 && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-medium truncate max-w-[135px]">
                  {businesses.find((b) => b.id === activeBusinessId)?.name || "Store"}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            onClick={onClose}
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400 dark:text-slate-500">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== `/${bizId}/dashboard` && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => onClose()}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150 group relative",
                        isActive
                          ? "bg-emerald-500/10 dark:bg-gradient-to-r dark:from-emerald-500/15 dark:to-cyan-500/5 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20 dark:border-emerald-500/30 shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-slate-200 border border-transparent"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-md bg-gradient-to-b from-emerald-400 to-cyan-400 shadow-sm shadow-cyan-400/50" />
                      )}
                      <Icon
                        size={16}
                        className={cn(
                          "transition-colors",
                          isActive
                            ? "text-emerald-600 dark:text-cyan-400"
                            : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                        )}
                      />
                      <span className="tracking-tight">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* POS Fast Action Launch in Sidebar footer */}
        <div className="p-3 border-t border-slate-200/80 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.01]">
          <Link
            href={`/${bizId}/sales/new`}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-sm shadow-emerald-600/25 hover:shadow-emerald-500/35 transition-all active:scale-[0.98]"
            onClick={() => onClose()}
          >
            <Icons.Plus size={15} />
            <span>{t("record_sale")}</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
