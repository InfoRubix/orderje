"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders the server component on an interval while the page is visible. */
export function AutoRefresh({ every = 5000, enabled = true }: { every?: number; enabled?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, every);
    return () => clearInterval(id);
  }, [router, every, enabled]);
  return null;
}
