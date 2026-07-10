import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { user } from "@/data/mockData";
import {
  User,
  MapPin,
  Shield,
  FileText,
  Link2,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  Briefcase,
  CreditCard,
  Settings,
  MessageCircle,
  Star,
  BadgeCheck,
} from "lucide-react";

const sections = [
  {
    title: "Account",
    items: [
      { icon: User, label: "Personal Information", path: "/profile/personal" },
      { icon: MapPin, label: "Address", path: "/profile/address" },
      { icon: BadgeCheck, label: "Identity & Verification", path: "/profile/identity", badge: "Verified" },
      { icon: Briefcase, label: "Employment & Income", path: "/profile/employment" },
    ],
  },
  {
    title: "Banking",
    items: [
      { icon: FileText, label: "Statements & Documents", path: "/profile/documents" },
      { icon: Link2, label: "Linked Accounts", path: "/profile/linked" },
      { icon: CreditCard, label: "Account Details", path: "/account/checking" },
    ],
  },
  {
    title: "Preferences",
    items: [
      { icon: Bell, label: "Notifications & Alerts", path: "/notifications/settings" },
      { icon: Shield, label: "Security Center", path: "/security" },
      { icon: Settings, label: "App Settings", path: "/settings" },
    ],
  },
  {
    title: "Support",
    items: [
      { icon: HelpCircle, label: "Help Center", path: "/help" },
      { icon: MessageCircle, label: "Contact Support", path: "/help/contact" },
      { icon: Star, label: "Rate Glass Bank", path: "#" },
    ],
  },
];

const ProfilePage = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="px-5 pt-14 space-y-5">
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full gradient-hero flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-foreground">
                {user.firstName[0]}{user.lastName[0]}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-sm text-muted-foreground">Member since {user.memberSince}</p>
              <p className="text-xs text-muted-foreground">{user.customerId}</p>
            </div>
          </div>
        </motion.div>

        {/* Sections */}
        {sections.map((section, si) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + si * 0.05 }}
          >
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              {section.title}
            </h2>
            <GlassCard className="divide-y divide-border p-0 overflow-hidden">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.path === "#") {
                      toast.success("Thanks for the love ❤️", { description: "Redirecting to App Store review…" });
                    } else {
                      navigate(item.path);
                    }
                  }}
                  className="flex items-center justify-between w-full px-4 py-3.5 active:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={20} className="text-primary" />
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {"badge" in item && item.badge && (
                      <span className="text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </div>
                </button>
              ))}
            </GlassCard>
          </motion.div>
        ))}

        {/* Sign Out */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <button
            onClick={() => { if (confirm("Sign out of Glass Bank?")) { toast.success("Signed out"); navigate("/login"); } }}
            className="w-full py-3 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold flex items-center justify-center gap-2"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </motion.div>

        {/* App Version */}
        <p className="text-center text-xs text-muted-foreground pb-4">Glass Bank v2.1.0 · Build 2026.03</p>
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
