import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Fingerprint,
  HelpCircle,
  ArrowRight,
} from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("alex.chen@email.com");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);

  const submit = () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Enter your email and password.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Welcome back, Alex");
      navigate("/");
    }, 600);
  };

  const faceId = () => {
    toast.loading("Authenticating with Face ID…", { id: "faceid" });
    setTimeout(() => {
      toast.success("Face ID recognized", { id: "faceid" });
      navigate("/");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
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
          <h1 className="text-3xl font-display font-bold text-foreground">Glass Bank</h1>
          <p className="text-sm text-muted-foreground mt-1">Banking, beautifully clear.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-sm space-y-4"
        >
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Email or Username</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex.chen@email.com"
              className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
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
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" className="rounded" defaultChecked />
              Remember device
            </label>
            <button
              onClick={() => toast.success("Password reset link sent to your email.")}
              className="text-xs text-primary font-medium"
            >
              Forgot password?
            </button>
          </div>

          <button
            onClick={submit}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? "Signing in…" : (<>Log In <ArrowRight size={16} /></>)}
          </button>

          <button
            onClick={faceId}
            className="w-full py-3.5 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Fingerprint size={18} /> Use Face ID
          </button>

          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={() => toast.info("We'll email you your username shortly.")}
              className="text-xs text-muted-foreground"
            >
              Forgot username
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={() => navigate("/help")}
              className="text-xs text-muted-foreground flex items-center gap-1"
            >
              <HelpCircle size={12} /> Need help?
            </button>
          </div>
        </motion.div>
      </div>

      <div className="px-8 pb-10">
        <button
          onClick={() => {
            toast.success("Account application started", { description: "Check your email — we sent you a link to finish opening your account." });
          }}
          className="w-full py-3 rounded-xl border border-border text-foreground text-sm font-semibold"
        >
          Open an Account
        </button>
      </div>
    </div>
  );
};

export default Login;
