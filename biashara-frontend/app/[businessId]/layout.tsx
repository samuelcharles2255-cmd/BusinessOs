"use client";

import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth";

export default function BusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const { setActiveBusinessId, activeBusinessId } = useAuth();

  useEffect(() => {
    if (params.businessId) {
      const bId = Number(params.businessId);
      if (!isNaN(bId) && bId !== activeBusinessId) {
        setActiveBusinessId(bId);
      }
    }
  }, [params.businessId, activeBusinessId, setActiveBusinessId]);

  return <AppShell>{children}</AppShell>;
}

