import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const Welcome = () => {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) navigate("/", { replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col px-8 py-10">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-24 h-24 rounded-3xl gradient-hero flex items-center justify-center mb-6 shadow-xl"
        >
          <span className="text-4xl font-display font-bold text-primary-foreground">G</span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl font-display font-bold text-foreground"
        >
          Glass Bank
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-base text-muted-foreground mt-2 max-w-sm"
        >
          Banking, beautifully clear. Move money, manage cards, and stay in control — all in one place.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-8 space-y-3 w-full max-w-sm"
        >
          <div className="flex items-center gap-3 text-left text-sm text-muted-foreground">
            <ShieldCheck size={18} className="text-primary" />
            Bank-grade encryption &amp; 2-factor security
          </div>
          <div className="flex items-center gap-3 text-left text-sm text-muted-foreground">
            <Sparkles size={18} className="text-primary" />
            Instant transfers, smart insights, zero clutter
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="w-full max-w-sm mx-auto space-y-3"
      >
        <button
          onClick={() => navigate("/signup")}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
        >
          Create Account <ArrowRight size={16} />
        </button>
        <button
          onClick={() => navigate("/login")}
          className="w-full py-3.5 rounded-xl bg-secondary text-foreground text-sm font-semibold"
        >
          I already have an account
        </button>
        <p className="text-[11px] text-muted-foreground text-center pt-2">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
};

export default Welcome;
