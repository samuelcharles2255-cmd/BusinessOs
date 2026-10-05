"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function RootPage() {
  const { user, activeBusinessId, businesses, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else {
      const bizId = activeBusinessId || (businesses.length > 0 ? businesses[0].id : 1);
      router.replace(`/${bizId}/dashboard`);
    }
  }, [user, activeBusinessId, businesses, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070a12]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 animate-pulse flex items-center justify-center text-white font-bold text-sm">
          B
        </div>
        <p className="text-xs text-slate-400 font-medium">Loading Biashara OS...</p>
      </div>
    </div>
  );
}
