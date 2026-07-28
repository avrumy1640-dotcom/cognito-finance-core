import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // The link uses type=recovery in hash; supabase-js auto-parses it.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Password updated");
    navigate("/");
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-8">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-display font-bold text-foreground text-center">Set a new password</h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground text-center">
            Open this page from the recovery link in your email.
          </p>
        ) : (
          <>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
            />
            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
