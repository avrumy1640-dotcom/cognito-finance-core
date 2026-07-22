import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, LifeBuoy } from "lucide-react";
import GlassCard from "@/components/glass/GlassCard";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      <GlassCard elevated className="max-w-sm w-full text-center py-8">
        <div className="text-5xl mb-3">🧭</div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-1">Page not found</h1>
        <p className="text-sm text-muted-foreground mb-6">
          We couldn't find <span className="font-mono">{location.pathname}</span>. Let's get you back on track.
        </p>
        <div className="space-y-2">
          <Link
            to="/"
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Home size={16} /> Go to Home
          </Link>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <Link
            to="/help"
            className="w-full py-3 rounded-xl bg-transparent text-primary text-sm font-medium flex items-center justify-center gap-2"
          >
            <LifeBuoy size={16} /> Get help
          </Link>
        </div>
      </GlassCard>
    </div>
  );
};

export default NotFound;
