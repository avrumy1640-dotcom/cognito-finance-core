import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { ArrowLeft, Settings, CheckCheck } from "lucide-react";

const iconMap: Record<string, string> = {
  deposit: "💰",
  card: "💳",
  transfer: "↗️",
  statement: "📄",
  savings: "🎯",
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications, markNotificationRead, markAllRead } = useBank();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <ArrowLeft size={20} className="text-foreground" />
            </button>
            <div>
              <h1 className="text-lg font-display font-bold text-foreground">Notifications</h1>
              <p className="text-xs text-muted-foreground">{unread} unread</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                onClick={() => { markAllRead(); toast.success("All marked as read"); }}
                className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
                title="Mark all as read"
              >
                <CheckCheck size={18} className="text-muted-foreground" />
              </button>
            )}
            <button
              onClick={() => toast.info("Notification settings", { description: "Coming soon" })}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
            >
              <Settings size={18} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {notifications.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">You're all caught up.</p>
          )}
          {notifications.map((n, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <GlassCard
                onClick={() => markNotificationRead(n.id)}
                className={`flex items-start gap-3 py-3 ${!n.read ? "border-l-2 border-l-accent" : ""}`}
              >
                <span className="text-lg mt-0.5">{iconMap[n.type] || "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />}
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
