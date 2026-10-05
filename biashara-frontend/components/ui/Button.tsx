"use client";

import React, { forwardRef } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "relative inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:opacity-50 disabled:pointer-events-none select-none overflow-hidden";

    const variantStyles = {
      primary: cn(
        "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white font-semibold",
        "shadow-sm shadow-emerald-500/25",
        "hover:shadow-[0_0_24px_-4px_rgba(16,185,129,0.45)] hover:from-emerald-500 hover:to-cyan-500",
        "border border-emerald-400/30",
        "active:shadow-inner"
      ),
      secondary: cn(
        "bg-white/80 dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.10]",
        "text-slate-800 dark:text-slate-200",
        "border border-slate-200/80 dark:border-white/[0.08]",
        "backdrop-blur-md shadow-2xs hover:border-slate-300 dark:hover:border-white/[0.16]"
      ),
      outline: cn(
        "bg-transparent hover:bg-white/[0.06]",
        "text-slate-700 dark:text-slate-200",
        "border border-slate-200/80 dark:border-white/[0.10]",
        "hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-400 hover:shadow-[0_0_16px_-4px_rgba(6,182,212,0.25)]"
      ),
      ghost: cn(
        "hover:bg-slate-100/80 dark:hover:bg-white/[0.06]",
        "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
      ),
      danger: cn(
        "bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold",
        "shadow-sm shadow-red-500/25 hover:shadow-[0_0_20px_-4px_rgba(244,63,94,0.45)]",
        "border border-rose-400/30"
      ),
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-xs sm:text-sm gap-2",
      lg: "h-11 px-6 text-sm sm:text-base gap-2.5",
      icon: "h-9 w-9 p-0",
    };

    return (
      <motion.button
        ref={ref}
        disabled={disabled || isLoading}
        whileHover={{ y: -1, scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
