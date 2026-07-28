import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, HelpCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Mode = "signin" | "signup";

interface Props {
  initialMode?: Mode;
}

const Login = ({ initialMode = "signin" }: Props) => {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [searchParams] = useSearchParams();
  const { signIn, signUp, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Preserve the OAuth consent URL (or any other same-origin next) through login.
  const nextParam = searchParams.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const redirectTarget = safeNext ?? (location.state?.from && location.state.from !== "/login" ? location.state.from : "/");

  const setModeAndUrl = (m: Mode) => {
    setMode(m);
    const base = m === "signin" ? "/login" : "/signup";
    const url = safeNext ? `${base}?next=${encodeURIComponent(safeNext)}` : base;
    navigate(url, { replace: true, state: location.state });
  };

  const submit = async () => {
    if (!email.trim() || !password.trim()) { toast.error("Enter your email and password."); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setLoading(true);
    if (mode === "signup") {
      const { error } = await signUp(email.trim(), password);
      setLoading(false);
      if (error) { toast.error(error); return; }
      toast.success("Account created — check your email to verify.");
      navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`, { replace: true });
      return;
    }
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) { toast.error(error); return; }

    // Check whether MFA challenge is required.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") {
      navigate("/mfa-challenge", { replace: true, state: { from: redirectTarget } });
      return;
    }
    toast.success("Welcome back");
    navigate(redirectTarget, { replace: true });
  };

  const forgot = async () => {
    if (!email.trim()) { toast.error("Enter your email above, then tap Forgot password."); return; }
    const { error } = await sendPasswordReset(email.trim());
    if (error) toast.error(error);
    else toast.success("Password reset link sent to your email.");
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col">
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
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="w-20 h-20 rounded-3xl gradient-hero mx-auto flex items-center justify-center mb-4 shadow-lg">
            <span className="text-3xl font-display font-bold text-primary-foreground">G</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "Sign in to continue to Glass Bank." : "Get started in under a minute."}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-sm space-y-4"
        >
          <div className="flex gap-1 p-1 bg-secondary rounded-xl">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setModeAndUrl(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="••••••••"
                className="w-full p-3.5 pr-12 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? <EyeOff size={18} className="text-muted-foreground" /> : <Eye size={18} className="text-muted-foreground" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Minimum 8 characters.</p>
          </div>

          {mode === "signin" && (
            <div className="flex items-center justify-end">
              <button onClick={forgot} className="text-xs text-primary font-medium">
                Forgot password?
              </button>
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading
              ? (mode === "signin" ? "Signing in…" : "Creating account…")
              : (<>{mode === "signin" ? "Log In" : "Create Account"} <ArrowRight size={16} /></>)}
          </button>

          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={() => navigate("/help")}
              className="text-xs text-muted-foreground flex items-center gap-1"
            >
              <HelpCircle size={12} /> Need help?
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
