import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { notifications } from "@/data/mockData";
import { ArrowLeft, Bell, Settings, ChevronRight } from "lucide-react";

const iconMap: Record<string, string> = {
  deposit: "💰",
  card: "💳",
  transfer: "↗️",
  statement: "📄",
  savings: "🎯",
};

const NotificationsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <ArrowLeft size={20} className="text-foreground" />
            </button>
            <h1 className="text-lg font-display font-bold text-foreground">Notifications</h1>
          </div>
          <button onClick={() => navigate("/notifications/settings")} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <Settings size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-2">
          {notifications.map((n, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <GlassCard className={`flex items-start gap-3 py-3 ${!n.read ? "border-l-2 border-l-primary" : ""}`}>
                <span className="text-lg mt-0.5">{iconMap[n.type] || "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
