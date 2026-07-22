import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const MfaChallenge = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const { signOut } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const target = location.state?.from && location.state.from !== "/login" ? location.state.from : "/";

  useEffect(() => {
    (async () => {
      const [{ data: aal }, { data: factors }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      // If MFA isn't needed, skip.
      if (!aal || aal.nextLevel !== "aal2" || aal.currentLevel === "aal2") {
        navigate(target, { replace: true });
        return;
      }
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        navigate(target, { replace: true });
        return;
      }
      setFactorId(totp.id);
      setChecking(false);
    })();
  }, [navigate, target]);

  const verify = async () => {
    if (!factorId || code.length < 6) { toast.error("Enter the 6-digit code."); return; }
    setLoading(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) { setLoading(false); toast.error(challenge.error.message); return; }
    const result = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    setLoading(false);
    if (result.error) { toast.error(result.error.message); return; }
    toast.success("Verified");
    navigate(target, { replace: true });
  };

  const cancel = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8">
      <button onClick={cancel} className="absolute top-6 left-6 flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft size={16} /> Cancel
      </button>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center space-y-5"
      >
        <div className="w-20 h-20 rounded-3xl bg-primary/10 mx-auto flex items-center justify-center">
          <ShieldCheck size={40} className="text-primary" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">Two-factor authentication</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app to finish signing in.
        </p>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && verify()}
          placeholder="123456"
          className="w-full p-4 rounded-xl bg-secondary text-foreground text-center text-2xl tracking-[0.5em] font-mono border-0 outline-none"
        />
        <button
          onClick={verify}
          disabled={loading || code.length < 6}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Verify & continue"}
        </button>
      </motion.div>
    </div>
  );
};

export default MfaChallenge;
