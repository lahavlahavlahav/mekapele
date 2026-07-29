"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { watchUserProfile } from "@/lib/firestore/user";

/** Live hearts balance for the signed-in user; null while unknown/signed out. */
export function useHearts(): number | null {
  const { user } = useAuth();
  const [hearts, setHearts] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setHearts(null);
      return;
    }
    return watchUserProfile(user.uid, (profile) => setHearts(profile?.hearts ?? 0));
  }, [user]);

  return hearts;
}
