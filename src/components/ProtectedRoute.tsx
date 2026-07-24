import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
  /** When true, users without a `verified` KYC status are redirected
   *  to /profile/verify. Use for any core banking route. */
  requireKyc?: boolean;
}

type CheckState = "pending" | "ok" | "required";

const ProtectedRoute = ({ children, requireKyc = false }: Props) => {
  const { session, user, loading } = useAuth();
  const location = useLocation();
  const [mfaCheck, setMfaCheck] = useState<CheckState>("pending");
  const [onboardCheck, setOnboardCheck] = useState<CheckState>("pending");
  const [kycCheck, setKycCheck] = useState<CheckState>("pending");

  useEffect(() => {
    if (!session || !user) {
      setMfaCheck("pending"); setOnboardCheck("pending"); setKycCheck("pending");
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: mfa }, { data: prof }, { data: kyc }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.from("profiles").select("onboarded_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("kyc_profiles").select("status").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (mfa?.nextLevel === "aal2" && mfa.currentLevel === "aal1") setMfaCheck("required");
      else setMfaCheck("ok");
      setOnboardCheck(prof?.onboarded_at ? "ok" : "required");
      setKycCheck((kyc?.status ?? "unverified") === "verified" ? "ok" : "required");
    })();
    return () => { cancelled = true; };
  }, [session, user]);

  if (loading || (session && (mfaCheck === "pending" || onboardCheck === "pending" || kycCheck === "pending"))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  }

  if (mfaCheck === "required") {
    return <Navigate to="/mfa-challenge" replace state={{ from: location.pathname }} />;
  }

  if (onboardCheck === "required" && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // Hard KYC gate for banking routes: unverified users cannot reach the ledger,
  // move-money, cards, or activity screens. They're routed to the verification
  // flow, which surfaces status (pending / under review / rejected) via
  // KycStatusCard.
  if (
    requireKyc &&
    kycCheck === "required" &&
    location.pathname !== "/profile/verify" &&
    location.pathname !== "/onboarding"
  ) {
    return <Navigate to="/profile/verify" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
