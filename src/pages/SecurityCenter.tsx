import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import {
  ArrowLeft,
  Lock,
  Fingerprint,
  Shield,
  Smartphone,
  Key,
  Eye,
  LogOut,
  AlertTriangle,
  ChevronRight,
  Monitor,
  Clock,
  Mail,
  Phone,
} from "lucide-react";

const SecurityCenter = () => {
  const navigate = useNavigate();

  const sections = [
    {
      title: "Login & Authentication",
      items: [
        { icon: Key, label: "Change Password", desc: "Last changed 45 days ago" },
        { icon: Fingerprint, label: "Biometric Login", desc: "Face ID enabled", toggle: true, enabled: true },
        { icon: Lock, label: "App Passcode", desc: "4-digit passcode enabled", toggle: true, enabled: true },
        { icon: Shield, label: "Two-Factor Authentication", desc: "SMS verification active" },
        { icon: Smartphone, label: "Trusted Devices", desc: "2 devices trusted" },
        { icon: Clock, label: "Login History", desc: "View recent logins" },
        { icon: Monitor, label: "Active Sessions", desc: "1 active session" },
        { icon: LogOut, label: "Sign Out All Devices", desc: "End all other sessions" },
      ],
    },
    {
      title: "Security Monitoring",
      items: [
        { icon: AlertTriangle, label: "Unusual Login Alerts", desc: "Enabled", toggle: true, enabled: true },
        { icon: Shield, label: "Suspicious Transaction Alerts", desc: "Enabled", toggle: true, enabled: true },
        { icon: Eye, label: "Fraud Center", desc: "No alerts" },
        { icon: Shield, label: "Identity Monitoring", desc: "No issues detected" },
      ],
    },
    {
      title: "Recovery & Verification",
      items: [
        { icon: Mail, label: "Recovery Email", desc: "ale***@email.com" },
        { icon: Phone, label: "Backup Phone", desc: "(415) ***-0142" },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h1 className="text-lg font-display font-bold text-foreground">Security Center</h1>
        </div>

        {/* Security Score */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard elevated className="text-center">
            <div className="w-20 h-20 rounded-full border-4 border-success mx-auto flex items-center justify-center mb-3">
              <span className="text-2xl font-display font-bold text-success">A+</span>
            </div>
            <h2 className="text-lg font-display font-bold text-foreground">Security Score: Excellent</h2>
            <p className="text-sm text-muted-foreground mt-1">All security features are properly configured</p>
          </GlassCard>
        </motion.div>

        {sections.map((section, si) => (
          <motion.div key={section.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + si * 0.05 }}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{section.title}</h2>
            <GlassCard className="divide-y divide-border p-0 overflow-hidden">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <item.icon size={20} className="text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                    </div>
                  </div>
                  {"toggle" in item ? (
                    <div className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${item.enabled ? "bg-primary" : "bg-secondary"}`}>
                      <div className={`w-5 h-5 rounded-full bg-primary-foreground shadow-sm transition-transform ${item.enabled ? "translate-x-5" : "translate-x-0"}`} />
                    </div>
                  ) : (
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  )}
                </div>
              ))}
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SecurityCenter;
