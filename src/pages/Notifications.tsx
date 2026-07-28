import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GlassCard from "@/components/glass/GlassCard";
import { useNotifications } from "@/hooks/useNotifications";
import { useNotificationPrefs, NotificationPrefs } from "@/hooks/useNotificationPrefs";
import { ArrowLeft, Settings, CheckCheck } from "lucide-react";

const iconMap: Record<string, string> = {
  deposit: "💰",
  card: "💳",
  transfer: "↗️",
  statement: "📄",
  savings: "🎯",
  kyc: "🪪",
  security: "🔐",
  scheduled_transfer: "🗓️",
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSettings = location.pathname.endsWith("/settings");
  const { items: notifications, unread, markRead: markNotificationRead, markAllRead, status } = useNotifications();
  const { prefs, status: prefsStatus, update } = useNotificationPrefs();

  const togglePref = async (key: keyof NotificationPrefs, label: string) => {
    const value = !prefs[key];
    const { error } = await update({ [key]: value } as Partial<NotificationPrefs>);
    if (error) toast.error(`Couldn't save ${label}: ${error}`);
    else toast.success(`${value ? "Enabled" : "Disabled"} ${label}`);
  };

  if (isSettings) {
    const rows: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
      { key: "push_deposits", label: "Deposits", desc: "Push when money hits your account" },
      { key: "push_card", label: "Card activity", desc: "Every charge, decline, and refund" },
      { key: "push_transfers", label: "Transfers", desc: "Book, ACH, wire status changes" },
      { key: "push_low_balance", label: "Low balance", desc: `When available drops below $${prefs.low_balance_amount}` },
      { key: "push_security", label: "Security alerts", desc: "New device sign-ins and unusual activity" },
      { key: "email_statements", label: "Email statements", desc: "Monthly PDF to your inbox" },
      { key: "email_marketing", label: "Product updates", desc: "New features and offers" },
    ];
    return (
      <div className="min-h-dvh bg-background">
        <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-10">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center">
              <ArrowLeft size={20} className="text-foreground" />
            </button>
            <h1 className="text-lg font-display font-bold text-foreground">Notification Settings</h1>
          </div>

          {prefsStatus === "loading" && (
            <GlassCard className="text-center py-8">
              <p className="text-sm text-muted-foreground">Loading your preferences…</p>
            </GlassCard>
          )}
          {prefsStatus === "error" && (
            <GlassCard className="text-center py-8">
              <p className="text-sm text-foreground">We couldn't load your notification preferences.</p>
              <button onClick={() => window.location.reload()} className="mt-3 text-xs font-semibold text-primary">Tap to retry</button>
            </GlassCard>
          )}

          {prefsStatus === "loaded" && (
            <>
              <GlassCard className="divide-y divide-border p-0 overflow-hidden">
                {rows.map((r) => (
                  <div key={r.key} className="flex items-start justify-between gap-4 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{r.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={Boolean(prefs[r.key])}
                      aria-label={r.label}
                      onClick={() => void togglePref(r.key, r.label.toLowerCase())}
                      className={`shrink-0 w-11 h-6 rounded-full transition-colors ${prefs[r.key] ? "bg-primary" : "bg-secondary"}`}
                    >
                      <span className={`block w-5 h-5 bg-background rounded-full shadow transform transition-transform ${prefs[r.key] ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                ))}
              </GlassCard>

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">Thresholds</p>
                <GlassCard className="divide-y divide-border p-0 overflow-hidden">
                  <div className="px-4 py-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">Large transaction</label>
                      <span className="text-xs text-muted-foreground">${prefs.large_txn_amount}</span>
                    </div>
                    <input
                      type="range" min={50} max={5000} step={50}
                      value={prefs.large_txn_amount}
                      onChange={(e) => void update({ large_txn_amount: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-muted-foreground">Notify me when a single transaction is at or above this amount.</p>
                  </div>
                  <div className="px-4 py-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">Low balance</label>
                      <span className="text-xs text-muted-foreground">${prefs.low_balance_amount}</span>
                    </div>
                    <input
                      type="range" min={0} max={2000} step={25}
                      value={prefs.low_balance_amount}
                      onChange={(e) => void update({ low_balance_amount: Number(e.target.value) })}
                      className="w-full accent-primary"
                    />
                    <p className="text-xs text-muted-foreground">Notify me when available balance drops below this amount.</p>
                  </div>
                </GlassCard>
                <p className="text-[11px] text-muted-foreground px-1 mt-2">
                  Email delivery isn't connected yet — email preferences are saved but no emails are sent until a provider is configured.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-dvh bg-background">
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center">
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
                onClick={() => { void markAllRead(); toast.success("All marked as read"); }}
                className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center"
                title="Mark all as read"
              >
                <CheckCheck size={18} className="text-muted-foreground" />
              </button>
            )}
            <button
              onClick={() => navigate("/notifications/settings")}
              className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center"
              title="Notification settings"
            >
              <Settings size={18} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {status === "loading" && (
            <GlassCard className="text-center py-8">
              <p className="text-sm text-muted-foreground">Loading notifications…</p>
            </GlassCard>
          )}
          {status === "loaded" && notifications.length === 0 && (
            <GlassCard className="text-center py-10">
              <div className="text-4xl mb-2">🔔</div>
              <p className="text-sm font-medium text-foreground">You're all caught up</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Deposits, card activity, and alerts will show up here.
              </p>
              <button
                onClick={() => navigate("/notifications/settings")}
                className="text-xs font-semibold text-primary"
              >
                Manage alert preferences →
              </button>
            </GlassCard>
          )}
          {notifications.map((n, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <GlassCard
                onClick={() => void markNotificationRead(n.id)}
                className={`flex items-start gap-3 py-3 ${!n.read_at ? "border-l-2 border-l-accent" : ""}`}
              >
                <span className="text-lg mt-0.5">{iconMap[n.type] || "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!n.read_at ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                {!n.read_at && <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />}
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
