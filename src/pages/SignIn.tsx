import { useState, FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function humanizeSignInError(msg: string): { text: string; unconfirmed?: boolean; rateLimited?: boolean } {
  const m = msg.toLowerCase();
  if (m.includes("email not confirmed") || m.includes("email_not_confirmed"))
    return { text: "Please confirm your email first. Check your inbox for the confirmation link.", unconfirmed: true };
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("invalid_grant"))
    return { text: "Incorrect email or password." };
  if (m.includes("rate limit") || m.includes("too many") || m.includes("429"))
    return { text: "Too many attempts. Please wait a moment and try again.", rateLimited: true };
  if (m.includes("network") || m.includes("fetch")) return { text: "Network error. Check your connection and try again." };
  if (m.includes("user not found")) return { text: "No account found with that email." };
  return { text: msg };
}

const SignIn = () => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [params] = useSearchParams();

  const nextParam = params.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const redirectTarget = safeNext ?? (location.state?.from && location.state.from !== "/login" ? location.state.from : "/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resetting, setResetting] = useState(false);

  const canSubmit = EMAIL_RE.test(email.trim()) && password.length >= 1 && !loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setUnconfirmed(false);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setLoading(false);
      const h = humanizeSignInError(error.message);
      if (h.unconfirmed) setUnconfirmed(true);
      toast.error(h.text);
      return;
    }

    // MFA gate: must clear challenge before landing anywhere else.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setLoading(false);
    if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") {
      navigate("/mfa-challenge", { replace: true, state: { from: redirectTarget } });
      return;
    }
    // ProtectedRoute handles onboarded/KYC/MFA gates from here based on live DB state.
    toast.success("Welcome back");
    navigate(redirectTarget, { replace: true });
  };

  const resendConfirmation = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      toast.error("Enter your email above first.");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    });
    setResending(false);
    if (error) toast.error(humanizeSignInError(error.message).text);
    else toast.success("Confirmation email sent.");
  };

  const forgotPassword = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      toast.error("Enter your email above, then tap Forgot password.");
      return;
    }
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    if (error) toast.error(humanizeSignInError(error.message).text);
    else toast.success("Password reset link sent to your email.");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <button
        onClick={() => navigate("/welcome")}
        className="absolute top-6 left-6 flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} /> Back
      </button>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="w-20 h-20 rounded-3xl gradient-hero mx-auto flex items-center justify-center mb-4 shadow-lg">
            <span className="text-3xl font-display font-bold text-primary-foreground">G</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to continue to Glass Bank.</p>
        </motion.div>

        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="text-xs text-muted-foreground font-medium mb-1.5 block">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-2 border-transparent outline-none focus:border-primary/40"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-xs text-muted-foreground font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-3.5 pr-12 rounded-xl bg-secondary text-foreground text-sm border-2 border-transparent outline-none focus:border-primary/40"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={18} className="text-muted-foreground" /> : <Eye size={18} className="text-muted-foreground" />}
              </button>
            </div>
          </div>

          {unconfirmed && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-foreground space-y-2">
              <p>Your email isn't confirmed yet. Check your inbox for the link we sent.</p>
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={resending}
                className="w-full py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {resending ? <Loader2 size={12} className="animate-spin" /> : null}
                {resending ? "Sending…" : "Resend confirmation email"}
              </button>
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={forgotPassword}
              disabled={resetting}
              className="text-xs text-primary font-medium disabled:opacity-60"
            >
              {resetting ? "Sending…" : "Forgot password?"}
            </button>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            New to Glass Bank?{" "}
            <Link to={safeNext ? `/signup?next=${encodeURIComponent(safeNext)}` : "/signup"} className="text-primary font-medium">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SignIn;
