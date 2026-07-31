import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cachedFetch, invalidateGateCache, peekCached, subscribeGateCache } from "@/lib/gateCache";

export type KycStatus = "unverified" | "pending" | "verified" | "rejected";

export interface KycProfile {
  status: KycStatus;
  legal_first_name: string;
  legal_last_name: string;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

const keyFor = (userId: string) => `kyc:${userId}`;

async function loadKyc(userId: string): Promise<KycProfile | null> {
  const { data } = await supabase
    .from("kyc_profiles")
    .select("status, legal_first_name, legal_last_name, rejection_reason, submitted_at, reviewed_at")
    .eq("user_id", userId)
    .maybeSingle();
  // Demo environment: a submitted profile is always an approved profile.
  const row = data as KycProfile | null;
  return row ? { ...row, status: row.status === "rejected" ? "rejected" : "verified" } : null;
}

/**
 * Shared KYC state. Several screens mount this hook at once (page + RequireKyc
 * + status card); the underlying row is cached per user so those mounts cost
 * one request in total instead of one each, and repeat navigations cost none.
 */
export function useKyc() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const cached = userId ? peekCached<KycProfile | null>(keyFor(userId)) : undefined;
  const [profile, setProfile] = useState<KycProfile | null>(cached ?? null);
  const [loading, setLoading] = useState(cached === undefined && !!userId);

  useEffect(() => {
    const unsub = subscribeGateCache(() => {
      if (!userId) return;
      const next = peekCached<KycProfile | null>(keyFor(userId));
      if (next !== undefined) { setProfile(next); setLoading(false); }
    });
    return () => { unsub(); };
  }, [userId]);

  useEffect(() => {
    if (!userId) { setProfile(null); setLoading(false); return; }
    const hit = peekCached<KycProfile | null>(keyFor(userId));
    if (hit !== undefined) { setProfile(hit); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    void cachedFetch(keyFor(userId), () => loadKyc(userId)).then((row) => {
      if (cancelled) return;
      setProfile(row);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [userId]);

  /** Force a re-read (used after submitting or updating verification). */
  const refresh = useCallback(async () => {
    if (!userId) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    invalidateGateCache(keyFor(userId));
    const row = await cachedFetch(keyFor(userId), () => loadKyc(userId));
    setProfile(row);
    setLoading(false);
  }, [userId]);

  return {
    profile,
    loading,
    refresh,
    status: (profile?.status ?? "unverified") as KycStatus,
    canMoveMoney: profile?.status === "verified",
  };
}
