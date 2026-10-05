"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, type = "text", ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[11px] font-mono font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400"
          >
            {label}
          </label>
        )}
        <div className="relative rounded-xl transition-all">
          <input
            id={inputId}
            ref={ref}
            type={type}
            className={cn(
              "w-full h-10 px-3.5 py-2 text-xs sm:text-sm rounded-xl transition-all duration-200",
              // Translucent glass input
              "bg-white/90 dark:bg-white/[0.04]",
              "border border-slate-200/90 dark:border-white/[0.08]",
              "text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500",
              // Plasma focus glow
              "focus:outline-none focus:border-cyan-500/60 dark:focus:border-cyan-400/60",
              "focus:ring-2 focus:ring-cyan-500/20 dark:focus:ring-cyan-400/20",
              "focus:shadow-[0_0_16px_-3px_rgba(6,182,212,0.25)]",
              error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 focus:shadow-[0_0_16px_-3px_rgba(244,63,94,0.25)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">{error}</p>}
        {helperText && !error && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
