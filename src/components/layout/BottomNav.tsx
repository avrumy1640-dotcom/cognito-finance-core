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
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card-elevated safe-bottom">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-0 flex-1"
            >
              {active && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <tab.icon
                size={22}
                className={active ? "text-primary" : "text-muted-foreground"}
                strokeWidth={active ? 2.2 : 1.5}
              />
              <span
                className={`text-[10px] font-medium ${
                  active ? "text-primary" : "text-muted-foreground"
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
