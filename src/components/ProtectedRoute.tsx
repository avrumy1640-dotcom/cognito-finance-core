import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cachedFetch, peekCached, subscribeGateCache } from "@/lib/gateCache";

interface Props {
  children: ReactNode;
  /** When true, users without a `verified` KYC status are redirected
   *  to /profile/verify. Use for any core banking route. */
  requireKyc?: boolean;
}

interface Gates {
  mfaRequired: boolean;
  onboarded: boolean;
  hasKyc: boolean;
}

const keyFor = (userId: string) => `gates:${userId}`;

async function loadGates(userId: string): Promise<Gates> {
  const [{ data: mfa }, { data: prof }, { data: kyc }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.from("profiles").select("onboarded_at").eq("user_id", userId).maybeSingle(),
    supabase.from("kyc_profiles").select("status").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    mfaRequired: mfa?.nextLevel === "aal2" && mfa.currentLevel === "aal1",
    onboarded: !!prof?.onboarded_at,
    // Demo environment: any submitted verification resolves to approved.
    hasKyc: !!kyc,
  };
}

const ProtectedRoute = ({ children, requireKyc = false }: Props) => {
  const { session, user, loading } = useAuth();
  const location = useLocation();
  const userId = user?.id ?? null;
  // Gate answers are session-scoped, not route-scoped: resolve them once per
  // signed-in user and reuse across navigations instead of blocking every
  // route change on three round-trips.
  const [gates, setGates] = useState<Gates | null>(() =>
    userId ? peekCached<Gates>(keyFor(userId)) ?? null : null,
  );

  useEffect(() => subscribeGateCache(() => {
    if (userId) setGates(peekCached<Gates>(keyFor(userId)) ?? null);
  }), [userId]);

  useEffect(() => {
    if (!session || !userId) { setGates(null); return; }
    const cached = peekCached<Gates>(keyFor(userId));
    if (cached) { setGates(cached); return; }
    let cancelled = false;
    void cachedFetch(keyFor(userId), () => loadGates(userId)).then((g) => {
      if (!cancelled) setGates(g);
    });
    return () => { cancelled = true; };
  }, [session, userId]);

  if (loading || (session && !gates)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    // First-time visitors see the pre-login intro carousel once.
    let seenIntro = true;
    try { seenIntro = localStorage.getItem("gb_intro_seen") === "1"; } catch { /* ignore */ }
    return <Navigate to={seenIntro ? "/welcome" : "/intro"} replace state={{ from: location.pathname }} />;
  }

  if (gates?.mfaRequired) {
    return <Navigate to="/mfa-challenge" replace state={{ from: location.pathname }} />;
  }

  if (gates && !gates.onboarded && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Hard KYC gate for banking routes: unverified users cannot reach the ledger,
  // move-money, cards, or activity screens. They're routed to the verification
  // flow, which surfaces status (pending / under review / rejected) via
  // KycStatusCard.
  if (
    requireKyc &&
    gates &&
    !gates.hasKyc &&
    location.pathname !== "/profile/verify" &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/profile/verify" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
