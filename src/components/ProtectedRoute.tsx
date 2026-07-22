import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [mfaCheck, setMfaCheck] = useState<"pending" | "ok" | "required">("pending");

  useEffect(() => {
    if (!session) { setMfaCheck("pending"); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      if (data?.nextLevel === "aal2" && data.currentLevel === "aal1") setMfaCheck("required");
      else setMfaCheck("ok");
    })();
    return () => { cancelled = true; };
  }, [session]);

  if (loading || (session && mfaCheck === "pending")) {
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

  return <>{children}</>;
};

export default ProtectedRoute;
