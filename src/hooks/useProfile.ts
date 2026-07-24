import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ProfileRow = {
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  account_type: string | null;
  business_name: string | null;
  country: string | null;
  onboarded_at: string | null;
  created_at: string | null;
};

/**
 * Shared read-only view of the current user's profile row. Sourced from the
 * `profiles` table (which is user-writable via PersonalInfo + Onboarding),
 * with graceful fallbacks to auth metadata so UI never renders a blank name.
 */
export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("profiles")
      .select("preferred_name, email, phone, account_type, business_name, country, onboarded_at, created_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setProfile((data as ProfileRow) ?? null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const displayName =
    (profile?.preferred_name?.trim() || "").split(/\s+/)[0] ||
    user?.user_metadata?.first_name ||
    (user?.email ? user.email.split("@")[0] : "");
  const fullName = profile?.preferred_name?.trim() || user?.email || "";
  const initials = (fullName || user?.email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "";

  return { profile, loading, displayName, fullName, initials, memberSince };
};
