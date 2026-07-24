import { Home, ArrowLeftRight, CreditCard, Activity, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", label: "Home", icon: Home },
  { path: "/move-money", label: "Move", icon: ArrowLeftRight },
  { path: "/cards", label: "Cards", icon: CreditCard },
  { path: "/activity", label: "Activity", icon: Activity },
  { path: "/profile", label: "Profile", icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 glass-card-elevated rounded-full px-1.5 py-1.5 safe-bottom">
      <div className="flex items-center justify-around gap-0.5 min-w-[320px] max-w-[92vw]">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center gap-0.5 px-3.5 py-1.5 min-w-0 flex-1 rounded-full press"
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <motion.div
                  layoutId="tab-bg"
                  className="absolute inset-0 rounded-full bg-foreground"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <tab.icon
                size={20}
                className={`relative z-10 transition-colors ${active ? "text-background" : "text-muted-foreground"}`}
                strokeWidth={active ? 2.2 : 1.6}
              />
              <span
                className={`relative z-10 text-[10px] font-semibold tracking-tight transition-colors ${
                  active ? "text-background" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
