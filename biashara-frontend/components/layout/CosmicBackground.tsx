"use client";

import React, { useEffect, useRef } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";

export function CosmicBackground() {
  const { theme } = useTheme();
  const auraRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      if (!auraRef.current) return;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        if (auraRef.current) {
          auraRef.current.style.transform = `translate3d(${e.clientX - 300}px, ${e.clientY - 300}px, 0)`;
        }
        rafId = null;
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none"
      style={{ contain: "paint" }}
    >
      {/* Base void background */}
      <div className="absolute inset-0 bg-[#f8fafc] dark:bg-[#03060f] transition-colors duration-500" />

      {/* Cosmic Nebula 1: Deep Violet-Indigo Plume */}
      <div
        className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] rounded-full blur-[80px] mix-blend-screen dark:mix-blend-lighten animate-nebula-1"
        style={{
          background:
            theme === "dark"
              ? "radial-gradient(circle, rgba(124, 58, 237, 0.16) 0%, rgba(99, 102, 241, 0.08) 50%, transparent 70%)"
              : "radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%)",
        }}
      />

      {/* Cosmic Nebula 2: Electric Cyan / Aurora Borealis Plume */}
      <div
        className="absolute top-[35%] -right-[15%] w-[50vw] h-[50vw] rounded-full blur-[90px] mix-blend-screen dark:mix-blend-lighten animate-nebula-2"
        style={{
          background:
            theme === "dark"
              ? "radial-gradient(circle, rgba(6, 182, 212, 0.14) 0%, rgba(16, 185, 129, 0.06) 50%, transparent 75%)"
              : "radial-gradient(circle, rgba(6, 182, 212, 0.04) 0%, transparent 70%)",
        }}
      />

      {/* Cosmic Nebula 3: Center Ambient Horizon */}
      <div
        className="absolute bottom-[-10%] left-[20%] w-[60vw] h-[40vw] rounded-full blur-[90px] mix-blend-screen dark:mix-blend-lighten"
        style={{
          background:
            theme === "dark"
              ? "radial-gradient(circle, rgba(79, 70, 229, 0.10) 0%, rgba(16, 185, 129, 0.05) 40%, transparent 70%)"
              : "radial-gradient(circle, rgba(16, 185, 129, 0.03) 0%, transparent 70%)",
        }}
      />

      {/* Subtle Gravitational Cursor Aura */}
      <div
        ref={auraRef}
        className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full blur-[70px] transition-opacity duration-300 opacity-60 dark:opacity-80 will-change-transform"
        style={{
          background:
            theme === "dark"
              ? "radial-gradient(circle, rgba(99, 102, 241, 0.10) 0%, rgba(6, 182, 212, 0.04) 40%, transparent 70%)"
              : "radial-gradient(circle, rgba(99, 102, 241, 0.04) 0%, transparent 70%)",
        }}
      />

      {/* Fine Stardust Particle Layer */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] mix-blend-screen"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}

