"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";
import { SkeletonStats, SkeletonCard } from "./ui/Skeleton";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen md:flex">
        <div className="hidden md:block w-64 shrink-0 border-r border-ink-200 bg-white" />
        <div className="flex-1 px-4 py-5 md:px-8 md:py-8 lg:px-10 max-w-6xl space-y-6">
          <div className="skeleton h-7 w-48" />
          <SkeletonStats />
          <SkeletonCard lines={5} />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
