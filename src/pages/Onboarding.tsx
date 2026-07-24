import { useEffect, useMemo, useRef, useState, KeyboardEvent, ReactNode } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AccountType = "personal" | "business";

interface FormState {
  account_type: AccountType | "";
  business_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  country: string;
  preferred_currency: string;
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
  account_type: "", business_name: "",
  first_name: "", last_name: "", phone: "",
  country: "", preferred_currency: "",
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
const CURRENCIES: [string, string, string][] = [
  ["USD", "$", "US Dollar"], ["EUR", "€", "Euro"], ["GBP", "£", "British Pound"],
  ["CAD", "$", "Canadian Dollar"], ["AUD", "$", "Australian Dollar"], ["JPY", "¥", "Japanese Yen"],
  ["SGD", "$", "Singapore Dollar"], ["AED", "د.إ", "UAE Dirham"], ["BRL", "R$", "Brazilian Real"],
  ["MXN", "$", "Mexican Peso"],
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
const DIAL_CODES: Record<string, string> = {
  US: "+1", CA: "+1", GB: "+44", DE: "+49", FR: "+33", ES: "+34", IT: "+39",
  NL: "+31", MX: "+52", BR: "+55", AU: "+61", JP: "+81", SG: "+65", AE: "+971",
};

type StepDef = {
  id: string;
  kicker: string;
  title: string;
  subtitle?: string;
  valid: () => boolean;
  autoAdvance?: boolean;
  render: (helpers: { next: () => void }) => ReactNode;
};

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
        const pn: string = (data.preferred_name || "").trim();
        const [first, ...rest] = pn.split(/\s+/);
        setForm((f) => ({
          ...f,
          account_type: (data.account_type as AccountType) || "",
          business_name: data.business_name || "",
          first_name: first || "",
          last_name: rest.join(" ") || "",
          phone: data.phone || "",
          country: data.country || "",
          preferred_currency: data.preferred_currency || "",
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
  const isBusiness = form.account_type === "business";

  const steps = useMemo<StepDef[]>(() => {
    const list: StepDef[] = [];
    let n = 0;
    const kicker = (label: string) => `${String(++n).padStart(2, "0")} · ${label}`;

    // 1. Account type
    list.push({
      id: "account_type",
      kicker: kicker("Account"),
      title: "How will you use Glass Bank?",
      valid: () => form.account_type !== "",
      autoAdvance: true,
      render: ({ next }) => (
        <div className="space-y-3">
          {([
            { key: "personal", label: "Personal", icon: UserIcon, desc: "Everyday spending, saving, transfers" },
            { key: "business", label: "Business", icon: Building2, desc: "Company payments, payroll, invoicing" },
          ] as const).map((opt) => {
            const active = form.account_type === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => { set("account_type", opt.key); setTimeout(next, 220); }}
                className={`w-full p-5 rounded-2xl text-left border-2 transition-all flex items-center gap-4 ${
                  active ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-border"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                  <opt.icon size={22} />
                </div>
                <div className="flex-1">
                  <div className="text-base font-semibold text-foreground">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                </div>
                {active && <Check size={20} className="text-primary" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      ),
    });

    // 2. Business name (only if business)
    if (isBusiness) {
      list.push({
        id: "business_name",
        kicker: kicker("Business"),
        title: "What's your business called?",
        subtitle: "Use the exact legal name on your registration.",
        valid: () => form.business_name.trim().length > 1,
        render: ({ next }) => (
          <SingleInput
            value={form.business_name}
            onChange={(v) => set("business_name", v)}
            onEnter={next}
            placeholder="Acme, Inc."
            autoComplete="organization"
          />
        ),
      });
    }

    // 3. Name (first + last, still a single-question screen — one topic)
    list.push({
      id: "name",
      kicker: kicker("Name"),
      title: "What's your legal name?",
      subtitle: "Match your government-issued ID exactly.",
      valid: () => form.first_name.trim().length > 0 && form.last_name.trim().length > 0,
      render: ({ next }) => (
        <div className="space-y-3">
          <SingleInput
            value={form.first_name}
            onChange={(v) => set("first_name", v)}
            onEnter={next}
            placeholder="First name"
            autoComplete="given-name"
          />
          <SingleInput
            value={form.last_name}
            onChange={(v) => set("last_name", v)}
            onEnter={next}
            placeholder="Last name"
            autoComplete="family-name"
            autoFocus={false}
          />
        </div>
      ),
    });

    // 4. Phone
    list.push({
      id: "phone",
      kicker: kicker("Phone"),
      title: "What's your mobile number?",
      subtitle: "We use it for security codes and account alerts.",
      valid: () => {
        const digits = form.phone.replace(/\D/g, "");
        return digits.length >= 8 && digits.length <= 15;
      },
      render: ({ next }) => (
        <PhoneInput
          value={form.phone}
          defaultCountry={form.country || "US"}
          onChange={(v) => set("phone", v)}
          onEnter={next}
        />
      ),
    });

    // 5. Country
    list.push({
      id: "country",
      kicker: kicker("Country"),
      title: "Where do you live?",
      valid: () => !!form.country,
      autoAdvance: true,
      render: ({ next }) => (
        <ChoiceList
          items={COUNTRIES.map(([c, l, flag]) => ({ id: c, label: l, prefix: flag }))}
          value={form.country}
          onChange={(v) => { set("country", v); setTimeout(next, 220); }}
        />
      ),
    });

    // Currency defaults to USD and is editable later in Settings — no longer
    // asked here to shave a step off the pre-KYC path.

    // Address — combined into one screen (street/city/region/postal). Multiple
    // inputs on the same topic is the Chime/Revolut standard; still one topic
    // per screen.
    list.push({
      id: "address",
      kicker: kicker("Address"),
      title: "Where do you live?",
      subtitle: "Where you receive mail today.",
      valid: () =>
        form.address_street.trim().length > 2 &&
        form.address_city.trim().length > 1 &&
        form.address_region.trim().length > 0 &&
        form.address_postal_code.trim().length > 2,
      render: ({ next }) => (
        <div className="space-y-3">
          <SingleInput
            value={form.address_street}
            onChange={(v) => set("address_street", v)}
            onEnter={next}
            placeholder="Street address"

            autoComplete="street-address"
          />
          <SingleInput
            value={form.address_city}
            onChange={(v) => set("address_city", v)}
            placeholder="City"
            autoComplete="address-level2"
            autoFocus={false}
          />
          <div className="grid grid-cols-2 gap-3">
            <SingleInput
              value={form.address_region}
              onChange={(v) => set("address_region", v)}
              placeholder="State / region"
              autoComplete="address-level1"
              autoFocus={false}
            />
            <SingleInput
              value={form.address_postal_code}
              onChange={(v) => set("address_postal_code", v)}
              onEnter={next}
              placeholder="Postal code"
              autoComplete="postal-code"
              autoFocus={false}
            />
          </div>
        </div>
      ),
    });

    // Occupation
    list.push({
      id: "occupation",
      kicker: kicker("Work"),
      title: isBusiness ? "What does your business do?" : "What do you do for work?",
      valid: () => form.occupation.trim().length > 1,
      render: ({ next }) => (
        <SingleInput
          value={form.occupation}
          onChange={(v) => set("occupation", v)}
          onEnter={next}
          placeholder={isBusiness ? "Retail, SaaS, Consulting…" : "Software Engineer"}
        />
      ),
    });

    // Employer moved to Settings > Personal Info — not required pre-KYC.

    // Income
    list.push({
      id: "income",
      kicker: kicker("Income"),
      title: "Estimated annual income?",
      subtitle: "Ballpark is fine.",
      valid: () => !!form.annual_income,
      autoAdvance: true,
      render: ({ next }) => (
        <ChoiceList
          items={INCOME_BANDS.map((b) => ({ id: b, label: b }))}
          value={form.annual_income}
          onChange={(v) => { set("annual_income", v); setTimeout(next, 220); }}
        />
      ),
    });

    // Source of funds
    list.push({
      id: "source",
      kicker: kicker("Source of funds"),
      title: "Where will your money come from?",
      subtitle: "Helps us keep everyone's accounts safe.",
      valid: () => !!form.source_of_funds,
      autoAdvance: true,
      render: ({ next }) => (
        <ChoiceList
          items={SOURCES.map((s) => ({ id: s, label: s }))}
          value={form.source_of_funds}
          onChange={(v) => { set("source_of_funds", v); setTimeout(next, 220); }}
        />
      ),
    });

    // Tax ID — tax residency defaults to residence country. Users with
    // multi-jurisdiction obligations can edit it later in Settings.
    if (needsTax) {
      const taxCountry = form.tax_country || form.country || "US";
      // Persist the inferred tax country so downstream KYC has it.
      if (form.tax_country !== taxCountry) set("tax_country", taxCountry);
      list.push({
        id: "tax_id",
        kicker: kicker(taxCountry === "US" ? "SSN" : "Tax ID"),
        title: taxCountry === "US" ? "What's your SSN or ITIN?" : "What's your tax ID number?",
        subtitle: "Encrypted end-to-end. Used only for regulatory reporting.",
        valid: () => form.tax_id_number.trim().length > 3,
        render: ({ next }) => (
          <SingleInput
            value={form.tax_id_number}
            onChange={(v) => set("tax_id_number", v)}
            onEnter={next}
            placeholder={taxCountry === "US" ? "•••-••-••••" : "Tax ID"}
            autoComplete="off"
            secure
          />
        ),
      });
    }


    // 17. Agreements
    list.push({
      id: "agreements",
      kicker: kicker("Agreements"),
      title: "Review and agree",
      subtitle: "One last step before we verify your identity.",
      valid: () => form.tos && form.privacy,
      render: () => (
        <div className="space-y-3">
          {[
            { key: "tos" as const, label: "Terms of Service", desc: "How Glass Bank works and what to expect from us." },
            { key: "privacy" as const, label: "Privacy Policy", desc: "How we collect, store, and protect your data." },
          ].map((it) => {
            const active = form[it.key];
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => set(it.key, !active)}
                className={`w-full flex items-start gap-3 p-4 rounded-2xl text-left border-2 transition-all ${
                  active ? "border-primary bg-primary/5" : "border-border/60 bg-card"
                }`}
              >
                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mt-0.5 shrink-0 ${active ? "border-primary bg-primary" : "border-border"}`}>
                  {active && <Check size={14} className="text-primary-foreground" strokeWidth={3} />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">I agree to the {it.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{it.desc}</div>
                </div>
              </button>
            );
          })}
          <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Shield size={13} /> Bank-grade encryption. Your data stays yours.
          </div>
        </div>
      ),
    });

    return list;
  }, [form, needsTax, isBusiness]);

  // Clamp step if flow shrinks (e.g. switched business→personal)
  useEffect(() => {
    if (step > steps.length - 1) setStep(steps.length - 1);
  }, [steps.length, step]);

  const current = steps[Math.min(step, steps.length - 1)];

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
      preferred_name: `${form.first_name} ${form.last_name}`.trim(),
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

  const goNext = async () => {
    if (!current.valid()) { toast.error("Please complete this step to continue."); return; }
    if (step < steps.length - 1) setStep(step + 1);
    else await finish();
  };

  const goBack = () => {
    if (step === 0) setShowIntro(true);
    else setStep(step - 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

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
          You're all set{form.first_name ? `, ${form.first_name}` : ""}
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

  if (showIntro) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 gradient-hero" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent))_0%,transparent_45%)]" />
          <div className="relative z-10 h-full flex flex-col justify-between p-8 pt-16">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary-foreground/10 backdrop-blur border border-primary-foreground/20 flex items-center justify-center">
                <span className="text-lg font-display font-bold text-primary-foreground">G</span>
              </div>
              <span className="text-sm font-semibold text-primary-foreground/90 tracking-wide">GLASS BANK</span>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-foreground/10 backdrop-blur border border-primary-foreground/20 mb-4">
                <Sparkles size={12} className="text-primary-foreground" />
                <span className="text-[11px] font-semibold text-primary-foreground uppercase tracking-wider">Takes 3 minutes</span>
              </div>
              <h1 className="text-4xl font-display font-bold text-primary-foreground leading-[1.05] tracking-tight">
                Let's set up<br />your account.
              </h1>
              <p className="text-base text-primary-foreground/75 mt-4 leading-relaxed max-w-sm">
                We'll ask one quick question at a time. You can pause anytime — your answers save automatically.
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

  const isLast = step === steps.length - 1;
  const isOptional = current.id === "employer";
  const canContinue = current.valid();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-5 pt-6 pb-4 sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={goBack}
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
            key={current.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-2">
              {current.kicker}
            </div>
            <h1 className="text-[28px] font-display font-bold text-foreground leading-[1.15] tracking-tight mb-2">
              {current.title}
            </h1>
            {current.subtitle && (
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{current.subtitle}</p>
            )}
            {!current.subtitle && <div className="mb-6" />}
            {current.render({ next: goNext })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-5 pb-8 pt-3 sticky bottom-0 bg-gradient-to-t from-background via-background to-background/0 space-y-2">
        <button
          onClick={goNext}
          disabled={saving || !canContinue}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
        >
          {saving ? (
            <><Loader2 size={16} className="animate-spin" /> Saving…</>
          ) : isLast ? (
            <>Finish & verify identity <Check size={16} /></>
          ) : (
            <>Continue <ArrowRight size={16} /></>
          )}
        </button>
        {isOptional && (
          <button
            onClick={() => setStep((s) => Math.min(s + 1, steps.length - 1))}
            className="w-full py-3 rounded-2xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
};

// —— Reusable pieces ——

const SingleInput = ({
  value, onChange, onEnter, placeholder, type, autoComplete, inputMode, autoFocus = true, secure = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "numeric" | "search" | "url" | "none" | "decimal";
  autoFocus?: boolean;
  secure?: boolean;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => ref.current?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); onEnter(); }
  };

  return (
    <input
      ref={ref}
      type={secure ? "password" : (type ?? "text")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKey}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      className="w-full px-4 py-5 rounded-2xl bg-secondary text-foreground text-lg border-2 border-transparent outline-none focus:border-primary/50 focus:bg-card transition-all placeholder:text-muted-foreground/60"
    />
  );
};

const ChoiceList = ({
  items, value, onChange,
}: {
  items: { id: string; label: string; prefix?: string }[];
  value: string;
  onChange: (id: string) => void;
}) => (
  <div className="space-y-2 max-h-[440px] overflow-y-auto hide-scrollbar pr-1 -mr-1">
    {items.map((it) => {
      const active = value === it.id;
      return (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={`w-full p-4 rounded-xl text-left flex items-center gap-3 border-2 transition-all ${
            active ? "border-primary bg-primary/5" : "border-transparent bg-secondary hover:bg-muted"
          }`}
        >
          {it.prefix && <span className="text-2xl leading-none">{it.prefix}</span>}
          <span className="flex-1 text-sm font-medium text-foreground">{it.label}</span>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? "border-primary bg-primary" : "border-border"}`}>
            {active && <Check size={12} className="text-primary-foreground" strokeWidth={3} />}
          </div>
        </button>
      );
    })}
  </div>
);

const PhoneInput = ({
  value, defaultCountry, onChange, onEnter,
}: {
  value: string;
  defaultCountry: string;
  onChange: (v: string) => void;
  onEnter: () => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Parse existing value into dial code + local digits, or fall back to defaultCountry.
  const parsed = useMemo(() => {
    const raw = (value || "").trim();
    if (raw.startsWith("+")) {
      const digits = raw.replace(/\D/g, "");
      // Try longest matching dial code first (up to 4 digits incl. leading char).
      const entries = Object.entries(DIAL_CODES).sort((a, b) => b[1].length - a[1].length);
      for (const [cc, dial] of entries) {
        const d = dial.replace(/\D/g, "");
        if (digits.startsWith(d)) {
          return { country: cc, dial, local: digits.slice(d.length) };
        }
      }
      return { country: defaultCountry, dial: DIAL_CODES[defaultCountry] || "+1", local: digits };
    }
    return {
      country: defaultCountry,
      dial: DIAL_CODES[defaultCountry] || "+1",
      local: raw.replace(/\D/g, ""),
    };
  }, [value, defaultCountry]);

  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 320);
    return () => clearTimeout(t);
  }, []);

  const emit = (country: string, local: string) => {
    const dial = DIAL_CODES[country] || "+1";
    const cleaned = local.replace(/\D/g, "").slice(0, 15);
    onChange(cleaned ? `${dial}${cleaned}` : "");
  };

  const digits = parsed.local;
  const totalDigits = parsed.dial.replace(/\D/g, "").length + digits.length;
  const showError = digits.length > 0 && (digits.length < 7 || totalDigits > 15);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          className="px-3 py-5 rounded-2xl bg-secondary text-foreground text-base font-semibold border-2 border-transparent hover:bg-muted transition-colors flex items-center gap-1.5 shrink-0"
          aria-label="Select country code"
        >
          <span className="text-xl leading-none">
            {COUNTRIES.find((c) => c[0] === parsed.country)?.[2] || "🌐"}
          </span>
          <span className="tabular-nums">{parsed.dial}</span>
        </button>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={digits}
          onChange={(e) => emit(parsed.country, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }}
          placeholder="555 123 4567"
          className="flex-1 min-w-0 px-4 py-5 rounded-2xl bg-secondary text-foreground text-lg border-2 border-transparent outline-none focus:border-primary/50 focus:bg-card transition-all placeholder:text-muted-foreground/60"
        />
      </div>
      {pickerOpen && (
        <div className="max-h-56 overflow-y-auto rounded-2xl border border-border bg-card shadow-lg divide-y divide-border">
          {COUNTRIES.filter((c) => DIAL_CODES[c[0]]).map(([code, name, flag]) => (
            <button
              key={code}
              type="button"
              onClick={() => { emit(code, digits); setPickerOpen(false); ref.current?.focus(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors"
            >
              <span className="text-lg">{flag}</span>
              <span className="flex-1 text-sm text-foreground">{name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{DIAL_CODES[code]}</span>
            </button>
          ))}
        </div>
      )}
      {showError ? (
        <p className="text-xs text-destructive px-1">
          Enter a valid mobile number (7–14 digits after the country code).
        </p>
      ) : (
        <p className="text-xs text-muted-foreground px-1">
          We'll text a verification code to this number.
        </p>
      )}
    </div>
  );
};

export default Onboarding;
