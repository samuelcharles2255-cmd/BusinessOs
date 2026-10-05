"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "neutral",
  size = "md",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    success:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 shadow-[0_0_12px_-3px_rgba(16,185,129,0.3)]",
    warning:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 shadow-[0_0_12px_-3px_rgba(245,158,11,0.3)]",
    danger:
      "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25 shadow-[0_0_12px_-3px_rgba(244,63,94,0.3)]",
    info:
      "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25 shadow-[0_0_12px_-3px_rgba(6,182,212,0.3)]",
    neutral:
      "bg-white/60 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/[0.08]",
  };

  const dotColors = {
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    info: "bg-cyan-400",
    neutral: "bg-slate-400",
  };

  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5 gap-1 font-mono",
    md: "text-xs px-2.5 py-0.5 gap-1.5 font-medium",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border backdrop-blur-md select-none transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full animate-cosmic-pulse shrink-0", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
