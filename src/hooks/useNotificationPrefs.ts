// Notification preferences, persisted in the `notification_preferences` table
// so they follow the user across devices (previously localStorage-only).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface NotificationPrefs {
  push_deposits: boolean;
  push_card: boolean;
  push_transfers: boolean;
  push_low_balance: boolean;
  push_security: boolean;
  email_statements: boolean;
  email_marketing: boolean;
  large_txn_amount: number;
  low_balance_amount: number;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  push_deposits: true,
  push_card: true,
  push_transfers: true,
  push_low_balance: true,
  push_security: true,
  email_statements: true,
  email_marketing: false,
  large_txn_amount: 500,
  low_balance_amount: 100,
};

export function useNotificationPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) { setStatus("loaded"); return; }
      const { data, error: err } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (err) { setError(err.message); setStatus("error"); return; }
      if (data) setPrefs({ ...DEFAULT_PREFS, ...(data as unknown as NotificationPrefs) });
      setStatus("loaded");
    };
    void load();
    return () => { cancelled = true; };
  }, [user]);

  const update = useCallback(
    async (patch: Partial<NotificationPrefs>) => {
      if (!user) return { error: "Not signed in" };
      const next = { ...prefs, ...patch };
      setPrefs(next);
      const { error: err } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
      if (err) {
        setPrefs(prefs); // revert — never pretend a save worked
        return { error: err.message };
      }
      return { error: null };
    },
    [user, prefs],
  );

  return { prefs, status, error, update };
}
