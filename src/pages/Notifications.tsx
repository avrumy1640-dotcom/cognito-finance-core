import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { loadAlertPrefs, saveAlertPrefs, AlertPrefs } from "@/lib/alerts";
import { ArrowLeft, Settings, CheckCheck } from "lucide-react";

const iconMap: Record<string, string> = {
  deposit: "💰",
  card: "💳",
  transfer: "↗️",
  statement: "📄",
  savings: "🎯",
};

const defaultPrefs = {
  pushDeposits: true,
  pushCard: true,
  pushTransfers: true,
  pushLowBalance: true,
  emailStatements: true,
  emailMarketing: false,
  smsSecurity: true,
};

type Prefs = typeof defaultPrefs;

const loadPrefs = (): Prefs => {
  try {
    const raw = localStorage.getItem("glassbank_notif_prefs");
    return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs;
  } catch {
    return defaultPrefs;
  }
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSettings = location.pathname.endsWith("/settings");
  const { notifications, markNotificationRead, markAllRead } = useBank();
  const unread = notifications.filter((n) => !n.read).length;
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [alerts, setAlerts] = useState<AlertPrefs>(loadAlertPrefs);

  const updateAlerts = (patch: Partial<AlertPrefs>) => {
    setAlerts((a) => {
      const next = { ...a, ...patch };
      saveAlertPrefs(next);
      return next;
    });
  };

  const togglePref = (key: keyof Prefs) => {
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      try { localStorage.setItem("glassbank_notif_prefs", JSON.stringify(next)); } catch { /* ignore */ }
      toast.success(`${next[key] ? "Enabled" : "Disabled"} ${labelFor(key)}`);
      return next;
    });
  };

  const labelFor = (k: keyof Prefs) => ({
    pushDeposits: "deposit alerts",
    pushCard: "card activity alerts",
    pushTransfers: "transfer alerts",
    pushLowBalance: "low balance alerts",
    emailStatements: "monthly email statements",
    emailMarketing: "marketing emails",
    smsSecurity: "security SMS alerts",
  }[k]);

  if (isSettings) {
    const rows: { key: keyof Prefs; label: string; desc: string }[] = [
      { key: "pushDeposits", label: "Deposits", desc: "Push when money hits your account" },
      { key: "pushCard", label: "Card activity", desc: "Every charge, decline, and refund" },
      { key: "pushTransfers", label: "Transfers", desc: "Book, ACH, wire status changes" },
      { key: "pushLowBalance", label: "Low balance", desc: "When available drops below $100" },
      { key: "emailStatements", label: "Email statements", desc: "Monthly PDF to your inbox" },
      { key: "emailMarketing", label: "Product updates", desc: "New features and offers" },
      { key: "smsSecurity", label: "Security SMS", desc: "Login codes and unusual activity" },
    ];
    return (
      <div className="min-h-screen bg-background">
        <div className="px-5 pt-14 space-y-5 pb-10">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <ArrowLeft size={20} className="text-foreground" />
            </button>
            <h1 className="text-lg font-display font-bold text-foreground">Notification Settings</h1>
          </div>
          <GlassCard className="divide-y divide-border p-0 overflow-hidden">
            {rows.map((r) => (
              <div key={r.key} className="flex items-start justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={prefs[r.key]}
                  onClick={() => togglePref(r.key)}
                  className={`shrink-0 w-11 h-6 rounded-full transition-colors ${prefs[r.key] ? "bg-primary" : "bg-secondary"}`}
                >
                  <span className={`block w-5 h-5 bg-background rounded-full shadow transform transition-transform ${prefs[r.key] ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </GlassCard>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">Real-time alerts</p>
            <GlassCard className="divide-y divide-border p-0 overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Enable real-time alerts</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Poll Column every {alerts.pollSeconds}s for new activity</p>
                </div>
                <button
                  role="switch"
                  aria-checked={alerts.enabled}
                  onClick={() => { updateAlerts({ enabled: !alerts.enabled }); toast.success(`Real-time alerts ${!alerts.enabled ? "on" : "off"}`); }}
                  className={`shrink-0 w-11 h-6 rounded-full transition-colors ${alerts.enabled ? "bg-primary" : "bg-secondary"}`}
                >
                  <span className={`block w-5 h-5 bg-background rounded-full shadow transform transition-transform ${alerts.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="px-4 py-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Large transaction threshold</label>
                  <span className="text-xs text-muted-foreground">${alerts.largeTxnAmount}</span>
                </div>
                <input
                  type="range" min={50} max={5000} step={50}
                  value={alerts.largeTxnAmount}
                  onChange={(e) => updateAlerts({ largeTxnAmount: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
                <p className="text-xs text-muted-foreground">Alert when a single transaction is at or above this amount.</p>
              </div>
              <div className="px-4 py-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Low balance threshold</label>
                  <span className="text-xs text-muted-foreground">${alerts.lowBalance}</span>
                </div>
                <input
                  type="range" min={0} max={2000} step={25}
                  value={alerts.lowBalance}
                  onChange={(e) => updateAlerts({ lowBalance: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
                <p className="text-xs text-muted-foreground">Alert when available balance drops below this amount.</p>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Card activity alerts</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Every card charge, lock, or unlock</p>
                </div>
                <button
                  role="switch"
                  aria-checked={alerts.cardActivity}
                  onClick={() => updateAlerts({ cardActivity: !alerts.cardActivity })}
                  className={`shrink-0 w-11 h-6 rounded-full transition-colors ${alerts.cardActivity ? "bg-primary" : "bg-secondary"}`}
                >
                  <span className={`block w-5 h-5 bg-background rounded-full shadow transform transition-transform ${alerts.cardActivity ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="px-4 py-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Poll interval</label>
                  <span className="text-xs text-muted-foreground">{alerts.pollSeconds}s</span>
                </div>
                <input
                  type="range" min={15} max={300} step={15}
                  value={alerts.pollSeconds}
                  onChange={(e) => updateAlerts({ pollSeconds: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
                <p className="text-xs text-muted-foreground">Changes take effect on next page reload.</p>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    );
  }

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
              onClick={() => navigate("/notifications/settings")}
              className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
              title="Notification settings"
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
