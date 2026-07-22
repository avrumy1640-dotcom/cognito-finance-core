import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, user, loading } = useAuth();
  const location = useLocation();
  const [mfaCheck, setMfaCheck] = useState<"pending" | "ok" | "required">("pending");
  const [onboardCheck, setOnboardCheck] = useState<"pending" | "ok" | "required">("pending");

  useEffect(() => {
    if (!session || !user) { setMfaCheck("pending"); setOnboardCheck("pending"); return; }
    let cancelled = false;
    (async () => {
      const [{ data: mfa }, { data: prof }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.from("profiles").select("onboarded_at").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (mfa?.nextLevel === "aal2" && mfa.currentLevel === "aal1") setMfaCheck("required");
      else setMfaCheck("ok");
      setOnboardCheck(prof?.onboarded_at ? "ok" : "required");
    })();
    return () => { cancelled = true; };
  }, [session, user]);

  if (loading || (session && (mfaCheck === "pending" || onboardCheck === "pending"))) {
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

  return <>{children}</>;
};

export default ProtectedRoute;
