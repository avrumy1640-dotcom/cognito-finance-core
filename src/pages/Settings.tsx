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
  LifeBuoy,
  Sparkles,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import SharedToggleRow from "@/components/glass/ToggleRow";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBank } from "@/store/bankStore";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/lib/theme";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import {

  biometricLabel,
  getBiometricKind,
  isAppLockEnabled,
  lockNow,
  setAppLockEnabled,
  setBiometricKind,
  type BiometricKind,
} from "@/lib/appLock";



const OVERDRAFT_LIMIT = 200;

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

const Settings = () => {
  const { cushion, setOverdraftOptIn } = useBank();
  const [odBusy, setOdBusy] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { theme, setTheme } = useTheme();
  const { pref: motionPref, reducedMotion, setPref: setMotionPref } = useReducedMotionPref();

  const [language, setLanguage] = useState<string>(() => localStorage.getItem("gb_lang") || "en");
  const [currency, setCurrency] = useState<string>("USD");
  const [timezone, setTimezone] = useState<string>(() =>
    localStorage.getItem("gb_tz") || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York"
  );
  const [notifPush, setNotifPush] = useState<boolean>(() => localStorage.getItem("gb_notif_push") !== "false");
  const [notifEmail, setNotifEmail] = useState<boolean>(() => localStorage.getItem("gb_notif_email") !== "false");
  const [notifSms, setNotifSms] = useState<boolean>(() => localStorage.getItem("gb_notif_sms") === "true");
  const [marketing, setMarketing] = useState<boolean>(() => localStorage.getItem("gb_marketing") === "true");
  const [biometrics, setBiometrics] = useState<boolean>(() => isAppLockEnabled());
  const [bioKind, setBioKind] = useState<BiometricKind>(() => getBiometricKind());
  const [hideBalances, setHideBalances] = useState<boolean>(() => localStorage.getItem("gb_hide_balances") === "true");

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

  const changeTheme = (t: Theme) => {
    setTheme(t);
    toast.success(t === "system" ? "Theme follows your device" : `${t === "dark" ? "Dark" : "Light"} theme on`);
  };

  const toggleBiometrics = () => {
    const next = !biometrics;
    setBiometrics(next);
    setAppLockEnabled(next);
    toast.success(next ? `${biometricLabel(bioKind)} unlock on` : "App lock off");
  };

  const changeBioKind = (k: BiometricKind) => {
    setBioKind(k);
    setBiometricKind(k);
    toast.success(`${biometricLabel(k)} selected`);
  };
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

            <div className="border-t border-border pt-3">
              <SharedToggleRow
                icon={Sparkles}
                label="Reduce motion"
                desc={
                  motionPref === "system"
                    ? `Following your device setting (currently ${reducedMotion ? "reduced" : "full"} motion)`
                    : reducedMotion
                      ? "Animations and the intro phone tilt are minimized"
                      : "Full animations, even if your device asks for less"
                }
                checked={reducedMotion}
                onChange={() => {
                  const next = reducedMotion ? "full" : "reduced";
                  setMotionPref(next);
                  toast.success(next === "reduced" ? "Reduced motion on" : "Full motion on");
                }}
              />
              {motionPref !== "system" && (
                <button
                  onClick={() => { setMotionPref("system"); toast.success("Motion follows your device"); }}
                  className="mt-2 text-xs font-medium text-primary"
                >
                  Use device setting
                </button>
              )}
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

        {/* Banking */}
        <Section title="Banking">
          <GlassCard className="divide-y divide-border p-0 overflow-hidden">
            <ToggleRow
              icon={LifeBuoy}
              label="Overdraft cushion"
              desc={
                cushion.enabled
                  ? `Checking can dip up to $${OVERDRAFT_LIMIT} below zero — never a fee`
                  : "Payments over your available balance are declined"
              }
              checked={cushion.enabled}
              onChange={() => {
                if (odBusy) return;
                setOdBusy(true);
                void setOverdraftOptIn(!cushion.enabled).finally(() => setOdBusy(false));
              }}
            />
            {cushion.enabled && (
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Cushion used</p>
                  <p className="text-xs font-semibold text-foreground tabular-nums">
                    ${cushion.used.toFixed(2)} of ${cushion.limit.toFixed(2)}
                  </p>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cushion.used > 0 ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${cushion.limit ? Math.min(100, (cushion.used / cushion.limit) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  ${cushion.remaining.toFixed(2)} still available. Deposits repay the cushion automatically, and we
                  never charge an overdraft fee.
                </p>
              </div>
            )}
          </GlassCard>
        </Section>

        {/* Privacy & Security */}
        <Section title="Privacy & Security">
          <GlassCard className="divide-y divide-border p-0 overflow-hidden">
            <ToggleRow
              icon={Fingerprint}
              label={`${biometricLabel(bioKind)} unlock`}
              desc="Lock the app and reopen it with a biometric check"
              checked={biometrics}
              onChange={toggleBiometrics}
            />
            {biometrics && (
              <div className="px-4 py-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: "face", label: "Face ID" },
                    { key: "fingerprint", label: "Fingerprint" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => changeBioKind(opt.key)}
                      className={`py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                        bioKind === opt.key
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-secondary text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { lockNow(); }}
                  className="w-full py-2.5 rounded-xl bg-secondary text-xs font-semibold text-foreground"
                >
                  Lock the app now
                </button>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  The app relocks when you reopen it, or after a minute in the background.
                  On the web the prompt is simulated for this demo.
                </p>
              </div>
            )}
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
            <LinkRow label="Joint accounts" onClick={() => navigate("/joint-accounts")} />

          </GlassCard>
        </Section>

        <p className="pt-2 text-center text-xs text-muted-foreground select-none">Glass Bank v2.1.0 · Build 2026.03</p>

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

/** Settings toggles reuse the shared row so switches look identical app-wide. */
const ToggleRow = ({
  icon, label, desc, checked, onChange,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string; desc?: string; checked: boolean; onChange: () => void;
}) => (
  <SharedToggleRow icon={icon} label={label} desc={desc} checked={checked} onChange={() => onChange()} />
);


const LinkRow = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
    <span className="text-sm font-medium text-foreground">{label}</span>
    <ChevronRight size={16} className="text-muted-foreground" />
  </button>
);

export default Settings;
