import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { MailCheck, RefreshCw, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session } = useAuth();
  const emailFromQuery = params.get("email") ?? "";
  const [email, setEmail] = useState(emailFromQuery);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    // If Supabase confirms email, a SIGNED_IN event fires with the new session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_IN" && next?.user?.email_confirmed_at) {
        setVerified(true);
      }
    });
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email_confirmed_at) setVerified(true);
      if (!email && data.user?.email) setEmail(data.user.email);
    });
    return () => sub.subscription.unsubscribe();
  }, [email]);

  const resend = async () => {
    if (!email) { toast.error("Enter the email you signed up with."); return; }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    });
    setResending(false);
    if (error) toast.error(error.message);
    else toast.success("Verification email sent.");
  };

  const goForward = () => {
    if (session) navigate("/", { replace: true });
    else navigate("/login", { replace: true });
  };

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
        {verified ? (
          <>
            <h1 className="text-2xl font-display font-bold text-foreground">Email verified</h1>
            <p className="text-sm text-muted-foreground">
              You're all set. Continue to your account to finish setup.
            </p>
            <button
              onClick={goForward}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-display font-bold text-foreground">Check your inbox</h1>
            <p className="text-sm text-muted-foreground">
              We sent a verification link to <span className="text-foreground font-medium">{email || "your email"}</span>.
              Tap the link to activate your account.
            </p>
            <div className="text-left">
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
              />
            </div>
            <button
              onClick={resend}
              disabled={resending}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <RefreshCw size={16} /> {resending ? "Sending…" : "Resend verification email"}
            </button>
            <button
              onClick={() => navigate("/login")}
              className="w-full py-3 text-sm text-muted-foreground"
            >
              Already verified? Log in
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
