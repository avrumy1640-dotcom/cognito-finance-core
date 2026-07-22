import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sun,
  Moon,
  Monitor,
  Globe,
  DollarSign,
  Clock,
  Bell,
  Fingerprint,
  Eye,
  Shield,
  ChevronRight,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Theme = "light" | "dark" | "system";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "SGD", "AED", "BRL", "MXN"];

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Toronto", "America/Mexico_City", "America/Sao_Paulo",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid",
  "Africa/Johannesburg", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Sydney",
];

const applyTheme = (t: Theme) => {
  const root = document.documentElement;
  const isDark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
};

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("gb_theme") as Theme) || "system");
  const [language, setLanguage] = useState<string>(() => localStorage.getItem("gb_lang") || "en");
  const [currency, setCurrency] = useState<string>("USD");
  const [timezone, setTimezone] = useState<string>(() =>
    localStorage.getItem("gb_tz") || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
  );
  const [notifPush, setNotifPush] = useState<boolean>(() => localStorage.getItem("gb_notif_push") !== "false");
  const [notifEmail, setNotifEmail] = useState<boolean>(() => localStorage.getItem("gb_notif_email") !== "false");
  const [notifSms, setNotifSms] = useState<boolean>(() => localStorage.getItem("gb_notif_sms") === "true");
  const [marketing, setMarketing] = useState<boolean>(() => localStorage.getItem("gb_marketing") === "true");
  const [biometrics, setBiometrics] = useState<boolean>(() => localStorage.getItem("gb_biometrics") === "true");
  const [hideBalances, setHideBalances] = useState<boolean>(() => localStorage.getItem("gb_hide_balances") === "true");

  useEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("preferred_currency")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.preferred_currency) setCurrency(data.preferred_currency);
    })();
  }, [user]);

  const persist = (key: string, value: string) => localStorage.setItem(key, value);

  const changeTheme = (t: Theme) => { setTheme(t); persist("gb_theme", t); toast.success(`Theme set to ${t}`); };
  const changeLang = (l: string) => { setLanguage(l); persist("gb_lang", l); toast.success("Language updated"); };
  const changeTz = (tz: string) => { setTimezone(tz); persist("gb_tz", tz); toast.success("Time zone updated"); };

  const changeCurrency = async (c: string) => {
    setCurrency(c);
    if (user) {
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, preferred_currency: c }, { onConflict: "user_id" });
      if (error) toast.error(error.message); else toast.success("Currency preference saved");
    }
  };

  const toggle = (key: string, setter: (v: boolean) => void, current: boolean, label: string) => {
    const next = !current;
    setter(next);
    persist(key, String(next));
    toast.success(`${label} ${next ? "on" : "off"}`);
  };

  return (
    <AppLayout>
      <div className="px-5 pt-6 pb-8 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-muted-foreground" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Personalize how Glass Bank works for you</p>
          </div>
        </div>

        {/* Appearance */}
        <Section title="Appearance">
          <GlassCard className="space-y-3">
            <p className="text-xs text-muted-foreground">Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: "light", label: "Light", icon: Sun },
                { key: "dark", label: "Dark", icon: Moon },
                { key: "system", label: "System", icon: Monitor },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => changeTheme(opt.key)}
                  className={`py-3 rounded-xl text-sm font-medium border transition-colors flex flex-col items-center gap-1.5 ${
                    theme === opt.key
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  <opt.icon size={18} />
                  {opt.label}
                </button>
              ))}
            </div>
          </GlassCard>
        </Section>

        {/* Localization */}
        <Section title="Localization">
          <GlassCard className="space-y-4">
            <SelectRow
              icon={Globe}
              label="Language"
              value={language}
              onChange={changeLang}
              options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            />
            <SelectRow
              icon={DollarSign}
              label="Currency"
              value={currency}
              onChange={changeCurrency}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
            <SelectRow
              icon={Clock}
              label="Time zone"
              value={timezone}
              onChange={changeTz}
              options={TIMEZONES.map((tz) => ({ value: tz, label: tz.replace("_", " ") }))}
            />
          </GlassCard>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <GlassCard className="divide-y divide-border p-0 overflow-hidden">
            <ToggleRow
              icon={Bell}
              label="Push notifications"
              desc="Transactions, alerts, and security events"
              checked={notifPush}
              onChange={() => toggle("gb_notif_push", setNotifPush, notifPush, "Push notifications")}
            />
            <ToggleRow
              icon={Bell}
              label="Email notifications"
              desc="Receipts, statements, and account updates"
              checked={notifEmail}
              onChange={() => toggle("gb_notif_email", setNotifEmail, notifEmail, "Email notifications")}
            />
            <ToggleRow
              icon={Bell}
              label="SMS notifications"
              desc="Critical alerts only"
              checked={notifSms}
              onChange={() => toggle("gb_notif_sms", setNotifSms, notifSms, "SMS notifications")}
            />
            <ToggleRow
              icon={Bell}
              label="Marketing communications"
              desc="Product news and offers"
              checked={marketing}
              onChange={() => toggle("gb_marketing", setMarketing, marketing, "Marketing")}
            />
          </GlassCard>
          <button
            onClick={() => navigate("/notifications/settings")}
            className="w-full mt-2 flex items-center justify-between px-4 py-3 rounded-xl bg-secondary text-sm text-foreground"
          >
            <span>Advanced alert thresholds</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </Section>

        {/* Privacy & Security */}
        <Section title="Privacy & Security">
          <GlassCard className="divide-y divide-border p-0 overflow-hidden">
            <ToggleRow
              icon={Fingerprint}
              label="Biometric unlock"
              desc="Use Face ID or fingerprint to sign in"
              checked={biometrics}
              onChange={() => toggle("gb_biometrics", setBiometrics, biometrics, "Biometric unlock")}
            />
            <ToggleRow
              icon={Eye}
              label="Hide balances by default"
              desc="Balances stay masked until you tap to reveal"
              checked={hideBalances}
              onChange={() => toggle("gb_hide_balances", setHideBalances, hideBalances, "Balance privacy")}
            />
          </GlassCard>
          <button
            onClick={() => navigate("/security")}
            className="w-full mt-2 flex items-center justify-between px-4 py-3 rounded-xl bg-secondary text-sm text-foreground"
          >
            <span className="flex items-center gap-2"><Shield size={16} className="text-primary" /> Security Center</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </Section>

        {/* Account */}
        <Section title="Account">
          <GlassCard className="divide-y divide-border p-0 overflow-hidden">
            <LinkRow label="Personal information" onClick={() => navigate("/profile/personal")} />
            <LinkRow label="Identity & verification" onClick={() => navigate("/profile/verify")} />
            <LinkRow label="Statements & documents" onClick={() => navigate("/profile/documents")} />
          </GlassCard>
        </Section>

        <p className="text-center text-xs text-muted-foreground pt-2">
          Glass Bank v2.1.0 · Build 2026.03
        </p>
      </div>
    </AppLayout>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{title}</h2>
    {children}
  </motion.div>
);

const SelectRow = ({
  icon: Icon, label, value, onChange, options,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      <Icon size={18} className="text-primary shrink-0" />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="p-2 rounded-lg bg-secondary text-foreground text-sm border-0 outline-none max-w-[55%]"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const ToggleRow = ({
  icon: Icon, label, desc, checked, onChange,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string; desc?: string; checked: boolean; onChange: () => void;
}) => (
  <button onClick={onChange} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left">
    <div className="flex items-center gap-3 min-w-0">
      <Icon size={18} className="text-primary shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground truncate">{desc}</p>}
      </div>
    </div>
    <span
      className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
        checked ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`block w-5 h-5 rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </span>
  </button>
);

const LinkRow = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
    <span className="text-sm font-medium text-foreground">{label}</span>
    <ChevronRight size={16} className="text-muted-foreground" />
  </button>
);

export default Settings;
