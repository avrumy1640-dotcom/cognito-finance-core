import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  User as UserIcon,
  Loader2,
  Shield,
  Sparkles,
  Lock,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AccountType = "personal" | "business";

interface FormState {
  account_type: AccountType | "";
  business_name: string;
  country: string;
  preferred_currency: string;
  preferred_name: string;
  phone: string;
  address_street: string;
  address_city: string;
  address_region: string;
  address_postal_code: string;
  occupation: string;
  employer: string;
  annual_income: string;
  source_of_funds: string;
  tax_country: string;
  tax_id_number: string;
  tos: boolean;
  privacy: boolean;
}

const EMPTY: FormState = {
  account_type: "", business_name: "", country: "", preferred_currency: "",
  preferred_name: "", phone: "",
  address_street: "", address_city: "", address_region: "", address_postal_code: "",
  occupation: "", employer: "", annual_income: "", source_of_funds: "",
  tax_country: "", tax_id_number: "",
  tos: false, privacy: false,
};

const COUNTRIES: [string, string, string][] = [
  ["US", "United States", "🇺🇸"], ["CA", "Canada", "🇨🇦"], ["GB", "United Kingdom", "🇬🇧"],
  ["DE", "Germany", "🇩🇪"], ["FR", "France", "🇫🇷"], ["ES", "Spain", "🇪🇸"],
  ["IT", "Italy", "🇮🇹"], ["NL", "Netherlands", "🇳🇱"], ["MX", "Mexico", "🇲🇽"],
  ["BR", "Brazil", "🇧🇷"], ["AU", "Australia", "🇦🇺"], ["JP", "Japan", "🇯🇵"],
  ["SG", "Singapore", "🇸🇬"], ["AE", "United Arab Emirates", "🇦🇪"],
];
const CURRENCIES: [string, string][] = [
  ["USD", "$"], ["EUR", "€"], ["GBP", "£"], ["CAD", "$"], ["AUD", "$"],
  ["JPY", "¥"], ["SGD", "$"], ["AED", "د.إ"], ["BRL", "R$"], ["MXN", "$"],
];
const SOURCES = [
  "Employment income", "Business income", "Investment income", "Savings",
  "Sale of assets", "Inheritance / gift", "Retirement", "Other",
];
const INCOME_BANDS = [
  "Under $25,000", "$25,000 – $50,000", "$50,000 – $100,000",
  "$100,000 – $250,000", "$250,000 – $500,000", "Over $500,000",
];
const REQUIRES_TAX_ID = new Set(["US", "CA", "GB", "DE", "FR", "ES", "IT", "NL", "AU"]);

type StepDef = { title: string; kicker: string; valid: () => boolean; render: () => JSX.Element };

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setForm((f) => ({
          ...f,
          account_type: (data.account_type as AccountType) || "",
          business_name: data.business_name || "",
          country: data.country || "",
          preferred_currency: data.preferred_currency || "",
          preferred_name: data.preferred_name || "",
          phone: data.phone || "",
          address_street: data.address_street || "",
          address_city: data.address_city || "",
          address_region: data.address_region || "",
          address_postal_code: data.address_postal_code || "",
          occupation: data.occupation || "",
          employer: data.employer || "",
          annual_income: data.annual_income || "",
          source_of_funds: data.source_of_funds || "",
          tax_country: data.tax_country || data.country || "",
          tax_id_number: data.tax_id_number || "",
          tos: !!data.tos_accepted_at,
          privacy: !!data.privacy_accepted_at,
        }));
      }
      setLoading(false);
    })();
  }, [user]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const needsTax = useMemo(() => REQUIRES_TAX_ID.has(form.country), [form.country]);

  const steps = useMemo<StepDef[]>(() => {
    const s: StepDef[] = [
      {
        kicker: "01 · About you",
        title: form.account_type === "business" ? "Tell us about your business" : "How will you use Glass Bank?",
        valid: () => form.account_type !== "" && (form.account_type !== "business" || form.business_name.trim().length > 1),
        render: () => (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {([
                { key: "personal", label: "Personal", icon: UserIcon, desc: "Everyday spending, saving, and transfers" },
                { key: "business", label: "Business", icon: Building2, desc: "Company payments, payroll, invoicing" },
              ] as const).map((opt) => {
                const active = form.account_type === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => set("account_type", opt.key)}
                    className={`p-4 rounded-2xl text-left border-2 transition-all flex items-center gap-4 ${
                      active ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 bg-card hover:border-border"
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                      <opt.icon size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">{opt.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? "border-primary bg-primary" : "border-border"}`}>
                      {active && <Check size={12} className="text-primary-foreground" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
            <AnimatePresence>
              {form.account_type === "business" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <FieldInput label="Legal business name" value={form.business_name} onChange={(v) => set("business_name", v)} placeholder="Acme, Inc." />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ),
      },
      {
        kicker: "02 · Location",
        title: "Where do you live?",
        valid: () => !!form.country,
        render: () => (
          <div className="space-y-2 max-h-[420px] overflow-y-auto hide-scrollbar pr-1">
            {COUNTRIES.map(([c, l, flag]) => {
              const active = form.country === c;
              return (
                <button
                  key={c}
                  onClick={() => set("country", c)}
                  className={`w-full p-3.5 rounded-xl text-left flex items-center gap-3 border-2 transition-all ${
                    active ? "border-primary bg-primary/5" : "border-transparent bg-secondary hover:bg-muted"
                  }`}
                >
                  <span className="text-2xl leading-none">{flag}</span>
                  <span className="flex-1 text-sm font-medium text-foreground">{l}</span>
                  {active && <Check size={18} className="text-primary" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        ),
      },
      {
        kicker: "03 · Currency",
        title: "Your primary currency",
        valid: () => !!form.preferred_currency,
        render: () => (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">You can add and switch between currencies anytime.</p>
            <div className="grid grid-cols-2 gap-2.5">
              {CURRENCIES.map(([c, sym]) => {
                const active = form.preferred_currency === c;
                return (
                  <button
                    key={c}
                    onClick={() => set("preferred_currency", c)}
                    className={`py-4 px-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${
                      active ? "border-primary bg-primary/5" : "border-border/60 bg-card"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                      {sym}
                    </div>
                    <span className="text-sm font-semibold text-foreground">{c}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ),
      },
      {
        kicker: "04 · Contact",
        title: "How should we reach you?",
        valid: () => form.preferred_name.trim().length > 0 && form.phone.trim().length > 4,
        render: () => (
          <div className="space-y-3">
            <FieldInput label="Preferred name" value={form.preferred_name} onChange={(v) => set("preferred_name", v)} placeholder="Alex Rivera" />
            <FieldInput label="Mobile phone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+1 555 123 4567" />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
              <Lock size={11} /> We only use your number for security alerts and support.
            </p>
          </div>
        ),
      },
      {
        kicker: "05 · Address",
        title: "Your home address",
        valid: () =>
          form.address_street.trim().length > 2 &&
          form.address_city.trim().length > 1 &&
          form.address_postal_code.trim().length > 2,
        render: () => (
          <div className="space-y-3">
            <FieldInput label="Street address" value={form.address_street} onChange={(v) => set("address_street", v)} placeholder="123 Market St, Apt 4B" />
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="City" value={form.address_city} onChange={(v) => set("address_city", v)} />
              <FieldInput label="Region / State" value={form.address_region} onChange={(v) => set("address_region", v)} />
            </div>
            <FieldInput label="Postal code" value={form.address_postal_code} onChange={(v) => set("address_postal_code", v)} />
          </div>
        ),
      },
      {
        kicker: "06 · Work",
        title: "What do you do?",
        valid: () => form.occupation.trim().length > 1 && !!form.annual_income,
        render: () => (
          <div className="space-y-3">
            <FieldInput label="Occupation" value={form.occupation} onChange={(v) => set("occupation", v)} placeholder="Software Engineer" />
            <FieldInput label="Employer (optional)" value={form.employer} onChange={(v) => set("employer", v)} placeholder="Acme Inc." />
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1.5 block uppercase tracking-wide">Annual income</label>
              <div className="grid grid-cols-1 gap-2">
                {INCOME_BANDS.map((b) => {
                  const active = form.annual_income === b;
                  return (
                    <button
                      key={b}
                      onClick={() => set("annual_income", b)}
                      className={`p-3 rounded-xl text-left text-sm border-2 transition-all flex items-center justify-between ${
                        active ? "border-primary bg-primary/5 text-foreground font-semibold" : "border-transparent bg-secondary text-foreground/80"
                      }`}
                    >
                      <span>{b}</span>
                      {active && <Check size={16} className="text-primary" strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ),
      },
      {
        kicker: "07 · Source of funds",
        title: "Where will your money come from?",
        valid: () => !!form.source_of_funds,
        render: () => (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground pb-1">This helps us keep your account and everyone else's safe.</p>
            {SOURCES.map((s) => {
              const active = form.source_of_funds === s;
              return (
                <button
                  key={s}
                  onClick={() => set("source_of_funds", s)}
                  className={`w-full p-3.5 rounded-xl text-left text-sm border-2 transition-all flex items-center justify-between ${
                    active ? "border-primary bg-primary/5 text-foreground font-semibold" : "border-transparent bg-secondary text-foreground/80"
                  }`}
                >
                  <span>{s}</span>
                  <ChevronRight size={16} className={active ? "text-primary" : "text-muted-foreground"} />
                </button>
              );
            })}
          </div>
        ),
      },
    ];

    if (needsTax) {
      s.push({
        kicker: "08 · Tax",
        title: "Tax residency",
        valid: () => form.tax_country.trim().length === 2 && form.tax_id_number.trim().length > 3,
        render: () => (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/10 flex gap-3">
              <Shield size={18} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed">
                Your tax details are encrypted and only used for regulatory reporting. We never share them for marketing.
              </p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1.5 block uppercase tracking-wide">Tax country</label>
              <select
                value={form.tax_country}
                onChange={(e) => set("tax_country", e.target.value)}
                className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">Select a country</option>
                {COUNTRIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </select>
            </div>
            <FieldInput
              label={form.tax_country === "US" ? "SSN / ITIN" : "Tax ID number"}
              value={form.tax_id_number}
              onChange={(v) => set("tax_id_number", v)}
              placeholder="•••-••-••••"
            />
          </div>
        ),
      });
    }

    s.push({
      kicker: `${String(s.length + 1).padStart(2, "0")} · Agreements`,
      title: "Review and agree",
      valid: () => form.tos && form.privacy,
      render: () => (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">One last step before we verify your identity.</p>
          {[
            { key: "tos" as const, label: "Terms of Service", desc: "How Glass Bank works and what to expect from us." },
            { key: "privacy" as const, label: "Privacy Policy", desc: "How we collect, store, and protect your data." },
          ].map((it) => {
            const active = form[it.key];
            return (
              <label
                key={it.key}
                className={`flex items-start gap-3 p-4 rounded-2xl cursor-pointer border-2 transition-all ${
                  active ? "border-primary bg-primary/5" : "border-border/60 bg-card"
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => set(it.key, e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mt-0.5 shrink-0 ${active ? "border-primary bg-primary" : "border-border"}`}>
                  {active && <Check size={14} className="text-primary-foreground" strokeWidth={3} />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">I agree to the {it.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{it.desc}</div>
                </div>
              </label>
            );
          })}
          <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Shield size={13} /> Bank-grade encryption. Your data stays yours.
          </div>
        </div>
      ),
    });

    return s;
  }, [form, needsTax]);

  const current = steps[step];

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    const now = new Date().toISOString();
    const payload = {
      user_id: user.id,
      email: user.email,
      account_type: form.account_type,
      business_name: form.business_name || null,
      country: form.country,
      preferred_currency: form.preferred_currency,
      preferred_name: form.preferred_name,
      phone: form.phone,
      address_street: form.address_street,
      address_city: form.address_city,
      address_region: form.address_region,
      address_postal_code: form.address_postal_code,
      occupation: form.occupation,
      employer: form.employer,
      annual_income: form.annual_income,
      source_of_funds: form.source_of_funds,
      tax_country: form.tax_country || null,
      tax_id_number: form.tax_id_number || null,
      onboarded_at: now,
      tos_accepted_at: now,
      privacy_accepted_at: now,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
    setTimeout(() => navigate("/profile/verify", { replace: true }), 1600);
  };

  const next = async () => {
    if (!current.valid()) { toast.error("Please complete this step to continue."); return; }
    if (step < steps.length - 1) setStep(step + 1);
    else await finish();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  // Success screen
  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="w-24 h-24 rounded-full gradient-hero flex items-center justify-center shadow-xl mb-6"
        >
          <Check size={44} className="text-primary-foreground" strokeWidth={3} />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-3xl font-display font-bold text-foreground text-center"
        >
          You're all set{form.preferred_name ? `, ${form.preferred_name.split(" ")[0]}` : ""}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-muted-foreground mt-2 text-center max-w-xs"
        >
          Taking you to identity verification to unlock your account…
        </motion.p>
      </div>
    );
  }

  // Intro / welcome screen (Chime / Revolut style)
  if (showIntro) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 gradient-hero" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent))_0%,transparent_45%)]" />
          <div className="relative z-10 h-full flex flex-col justify-between p-8 pt-16">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-9 h-9 rounded-xl bg-primary-foreground/10 backdrop-blur border border-primary-foreground/20 flex items-center justify-center">
                <span className="text-lg font-display font-bold text-primary-foreground">G</span>
              </div>
              <span className="text-sm font-semibold text-primary-foreground/90 tracking-wide">GLASS BANK</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-foreground/10 backdrop-blur border border-primary-foreground/20 mb-4">
                <Sparkles size={12} className="text-primary-foreground" />
                <span className="text-[11px] font-semibold text-primary-foreground uppercase tracking-wider">Takes 3 minutes</span>
              </div>
              <h1 className="text-4xl font-display font-bold text-primary-foreground leading-[1.05] tracking-tight">
                Let's set up<br />your account.
              </h1>
              <p className="text-base text-primary-foreground/75 mt-4 leading-relaxed max-w-sm">
                A few quick questions so we can open your account and keep it secure.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="bg-card px-6 pt-6 pb-8 rounded-t-3xl -mt-6 relative z-20 shadow-2xl">
          <div className="space-y-3 mb-5">
            {[
              { icon: UserIcon, label: "Tell us about yourself", desc: "Name, contact, and address" },
              { icon: Building2, label: "A bit about your work", desc: "Occupation and income" },
              { icon: Shield, label: "Verify your identity", desc: "Fast, encrypted, and secure" },
            ].map((it, i) => (
              <motion.div
                key={it.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <it.icon size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{it.label}</div>
                  <div className="text-xs text-muted-foreground">{it.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
          <button
            onClick={() => setShowIntro(false)}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
          >
            Get started <ArrowRight size={16} />
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-3 flex items-center justify-center gap-1.5">
            <Lock size={11} /> Encrypted end-to-end · FDIC-insured partner banks
          </p>
        </div>
      </div>
    );
  }

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-5 pt-6 pb-4 sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => step === 0 ? setShowIntro(true) : setStep(step - 1)}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <div className="flex-1 flex gap-1">
            {steps.map((_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={false}
                  animate={{ width: i <= step ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            {step + 1}/{steps.length}
          </span>
        </div>
      </div>

      <div className="flex-1 px-5 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-2">
              {current.kicker}
            </div>
            <h1 className="text-[26px] font-display font-bold text-foreground leading-tight tracking-tight mb-6">
              {current.title}
            </h1>
            {current.render()}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-5 pb-8 pt-3 sticky bottom-0 bg-gradient-to-t from-background via-background to-background/0">
        <button
          onClick={next}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
        >
          {saving ? (
            <><Loader2 size={16} className="animate-spin" /> Saving…</>
          ) : step === steps.length - 1 ? (
            <>Finish & verify identity <Check size={16} /></>
          ) : (
            <>Continue <ArrowRight size={16} /></>
          )}
        </button>
      </div>
    </div>
  );
};

const FieldInput = ({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) => (
  <div>
    <label className="text-xs text-muted-foreground font-semibold mb-1.5 block uppercase tracking-wide">{label}</label>
    <input
      type={type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-2 border-transparent outline-none focus:border-primary/40 focus:bg-card transition-colors"
    />
  </div>
);

export default Onboarding;
