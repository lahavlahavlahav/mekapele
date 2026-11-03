"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export interface SubscriptionStatus {
  /** Epoch ms the monthly pass runs until (0 = never subscribed). */
  activeUntil: number;
  active: boolean;
}

/**
 * The signed-in user's monthly-pass status, from GET /api/subscription.
 * null while unknown or signed out. Refetches when the tab regains focus -
 * that's when someone returns from the Grow payment page.
 */
export function useSubscription(): { status: SubscriptionStatus | null; refresh: () => void } {
  const { user, getToken } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);

  const refresh = useCallback(() => {
    if (!user) {
      setStatus(null);
      return;
    }
    getToken()
      .then((token) =>
        fetch("/api/subscription", { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setStatus({ activeUntil: Number(json.activeUntil) || 0, active: !!json.active });
      })
      .catch(() => {});
  }, [user, getToken]);

  useEffect(() => {
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  return { status, refresh };
}

/** "3.12.2026"-style date for the pass's end. */
export function formatUntil(activeUntil: number): string {
  return new Date(activeUntil).toLocaleDateString("he-IL");
}
