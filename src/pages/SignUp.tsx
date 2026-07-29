import { useMemo, useState, FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string | null };
function scorePassword(pw: string): Strength {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 12) s++;
  const labels = ["Too short", "Weak", "Okay", "Strong", "Excellent"] as const;
  const hint =
    pw.length < 8
      ? "Use at least 8 characters."
      : !/\d/.test(pw)
      ? "Add a number for extra strength."
      : !/[A-Z]/.test(pw) || !/[a-z]/.test(pw)
      ? "Mix upper and lower case."
      : null;
  return { score: s as Strength["score"], label: labels[s], hint };
}

function humanizeSignupError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists") || m.includes("user already"))
    return "This email is already registered. Try signing in instead.";
  if (m.includes("password") && m.includes("weak")) return "That password is too weak. Try something longer.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("network") || m.includes("fetch")) return "Network error. Check your connection and try again.";
  if (m.includes("invalid") && m.includes("email")) return "That email address doesn't look right.";
  return msg;
}

const SignUp = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextParam = params.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<null | { email: string }>(null);
  const [resending, setResending] = useState(false);

  const emailValid = useMemo(() => EMAIL_RE.test(email.trim()), [email]);
  const strength = useMemo(() => scorePassword(password), [password]);
  const pwValid = password.length >= 8 && strength.score >= 2;
  const canSubmit = emailValid && pwValid && !loading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    const redirect = `${window.location.origin}/verify-email${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirect },
    });
    setLoading(false);
    if (error) {
      toast.error(humanizeSignupError(error.message));
      return;
    }
    // If email confirmation is required, session will be null and user.identities empty means duplicate.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      toast.error("This email is already registered. Try signing in instead.");
      return;
    }
    setSent({ email: email.trim() });
  };

  const resend = async () => {
    if (!sent) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: sent.email,
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    });
    setResending(false);
    if (error) toast.error(humanizeSignupError(error.message));
    else toast.success("Confirmation email sent again.");
  };

  if (sent) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-8">
        <button
          onClick={() => navigate("/welcome")}
          className="absolute top-6 left-6 flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm text-center space-y-5"
        >
          <div className="w-20 h-20 rounded-3xl bg-primary/10 mx-auto flex items-center justify-center">
            <MailCheck size={40} className="text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">Confirm your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to <span className="text-foreground font-medium">{sent.email}</span>.
            Tap the link in that email to activate your account before signing in.
          </p>
          <button
            onClick={resend}
            disabled={resending}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {resending ? <Loader2 size={16} className="animate-spin" /> : null}
            {resending ? "Sending…" : "Resend confirmation email"}
          </button>
          <button
            onClick={() => navigate("/login")}
            className="w-full py-3 text-sm text-muted-foreground"
          >
            I already confirmed — sign in
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <Seo
        title="Create your Glass Bank account"
        description="Open a Glass Bank account in minutes — instant transfers, smart cards, savings goals, and spending insights."
        path="/signup"
      />
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
          <h1 className="text-3xl font-display font-bold text-foreground">Create your account</h1>
          <p className="text-sm text-muted-foreground mt-1">Get started in under a minute.</p>
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
            {email.length > 0 && !emailValid && (
              <p className="text-[11px] text-destructive mt-1">Enter a valid email address.</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="text-xs text-muted-foreground font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
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
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < strength.score
                          ? strength.score >= 3
                            ? "bg-primary"
                            : strength.score === 2
                            ? "bg-yellow-500"
                            : "bg-destructive"
                          : "bg-secondary"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{strength.label}</span>
                  {strength.hint ? ` — ${strength.hint}` : ""}
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            Already have an account?{" "}
            <Link to={safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/login"} className="text-primary font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default SignUp;
