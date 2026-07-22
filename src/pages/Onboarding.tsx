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
  account_type: "",
  business_name: "",
  country: "",
  preferred_currency: "",
  preferred_name: "",
  phone: "",
  address_street: "",
  address_city: "",
  address_region: "",
  address_postal_code: "",
  occupation: "",
  employer: "",
  annual_income: "",
  source_of_funds: "",
  tax_country: "",
  tax_id_number: "",
  tos: false,
  privacy: false,
};

const COUNTRIES = [
  ["US", "United States"], ["CA", "Canada"], ["GB", "United Kingdom"],
  ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"], ["IT", "Italy"],
  ["NL", "Netherlands"], ["MX", "Mexico"], ["BR", "Brazil"], ["AU", "Australia"],
  ["JP", "Japan"], ["SG", "Singapore"], ["AE", "United Arab Emirates"],
];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "SGD", "AED", "BRL", "MXN"];
const SOURCES = [
  "Employment income", "Business income", "Investment income",
  "Savings", "Sale of assets", "Inheritance / gift", "Retirement", "Other",
];
const INCOME_BANDS = [
  "Under $25,000", "$25,000 – $50,000", "$50,000 – $100,000",
  "$100,000 – $250,000", "$250,000 – $500,000", "Over $500,000",
];

const REQUIRES_TAX_ID = new Set(["US", "CA", "GB", "DE", "FR", "ES", "IT", "NL", "AU"]);

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
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

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const needsTax = useMemo(() => REQUIRES_TAX_ID.has(form.country), [form.country]);

  const steps = useMemo(() => {
    const s: { title: string; valid: () => boolean; render: () => JSX.Element }[] = [
      {
        title: "Account type",
        valid: () => form.account_type !== "" && (form.account_type !== "business" || form.business_name.trim().length > 1),
        render: () => (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Which best describes you?</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "personal", label: "Personal", icon: UserIcon, desc: "For your own money" },
                { key: "business", label: "Business", icon: Building2, desc: "For a company" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => set("account_type", opt.key)}
                  className={`p-4 rounded-2xl text-left border transition-colors ${
                    form.account_type === opt.key
                      ? "border-primary bg-primary/5"
                      : "border-border bg-secondary"
                  }`}
                >
                  <opt.icon size={22} className="text-primary mb-2" />
                  <div className="text-sm font-semibold text-foreground">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.desc}</div>
                </button>
              ))}
            </div>
            {form.account_type === "business" && (
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Business name</label>
                <input
                  value={form.business_name}
                  onChange={(e) => set("business_name", e.target.value)}
                  placeholder="Acme, Inc."
                  className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
                />
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Country",
        valid: () => !!form.country,
        render: () => (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Where are you based?</p>
            <select
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
              className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
            >
              <option value="">Select a country</option>
              {COUNTRIES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
            </select>
          </div>
        ),
      },
      {
        title: "Currency",
        valid: () => !!form.preferred_currency,
        render: () => (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Pick your default currency. You can add more later.</p>
            <div className="grid grid-cols-3 gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  onClick={() => set("preferred_currency", c)}
                  className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                    form.preferred_currency === c
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ),
      },
      {
        title: "About you",
        valid: () => form.preferred_name.trim().length > 0 && form.phone.trim().length > 4,
        render: () => (
          <div className="space-y-3">
            <FieldInput label="Preferred name" value={form.preferred_name} onChange={(v) => set("preferred_name", v)} placeholder="Alex Rivera" />
            <FieldInput label="Phone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+1 555 123 4567" />
          </div>
        ),
      },
      {
        title: "Address",
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
        title: "Employment",
        valid: () => form.occupation.trim().length > 1 && !!form.annual_income,
        render: () => (
          <div className="space-y-3">
            <FieldInput label="Occupation" value={form.occupation} onChange={(v) => set("occupation", v)} placeholder="Software Engineer" />
            <FieldInput label="Employer (optional)" value={form.employer} onChange={(v) => set("employer", v)} placeholder="Acme Inc." />
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Annual income</label>
              <select
                value={form.annual_income}
                onChange={(e) => set("annual_income", e.target.value)}
                className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
              >
                <option value="">Select a range</option>
                {INCOME_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
        ),
      },
      {
        title: "Source of funds",
        valid: () => !!form.source_of_funds,
        render: () => (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Where will the money in this account primarily come from?</p>
            <div className="grid grid-cols-1 gap-2">
              {SOURCES.map((s) => (
                <button
                  key={s}
                  onClick={() => set("source_of_funds", s)}
                  className={`p-3.5 rounded-xl text-left text-sm border transition-colors ${
                    form.source_of_funds === s
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ),
      },
    ];

    if (needsTax) {
      s.push({
        title: "Tax information",
        valid: () => form.tax_country.trim().length === 2 && form.tax_id_number.trim().length > 3,
        render: () => (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your tax residency helps us meet reporting requirements. We store this securely.
            </p>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Tax country</label>
              <select
                value={form.tax_country}
                onChange={(e) => set("tax_country", e.target.value)}
                className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
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
      title: "Terms & Privacy",
      valid: () => form.tos && form.privacy,
      render: () => (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Almost done — please review and accept our Terms of Service and Privacy Policy to continue.
          </p>
          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={form.tos}
              onChange={(e) => set("tos", e.target.checked)}
              className="mt-1 accent-primary"
            />
            <span className="text-sm text-foreground">
              I agree to the <span className="text-primary underline">Terms of Service</span>.
            </span>
          </label>
          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={form.privacy}
              onChange={(e) => set("privacy", e.target.checked)}
              className="mt-1 accent-primary"
            />
            <span className="text-sm text-foreground">
              I've read the <span className="text-primary underline">Privacy Policy</span> and consent to how my data is used.
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            Next you'll verify your identity to unlock full banking features.
          </p>
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
    const payload: Record<string, unknown> = {
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
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome to Glass Bank");
    navigate("/profile/verify", { replace: true });
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

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-5 pt-6 pb-3 flex items-center gap-3">
        <button
          onClick={() => step === 0 ? navigate(-1) : setStep(step - 1)}
          className="p-2 -ml-2 text-muted-foreground"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Step {step + 1} of {steps.length} · {current.title}
          </p>
        </div>
      </div>

      <div className="flex-1 px-5 pt-4 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
          >
            <h1 className="text-2xl font-display font-bold text-foreground mb-1">{current.title}</h1>
            <div className="mt-5">{current.render()}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-5 pb-8 pt-2">
        <button
          onClick={next}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? "Saving…" : step === steps.length - 1
            ? (<>Finish & verify identity <Check size={16} /></>)
            : (<>Continue <ArrowRight size={16} /></>)}
        </button>
      </div>
    </div>
  );
};

const FieldInput = ({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) => (
  <div>
    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">{label}</label>
    <input
      type={type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full p-3.5 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
    />
  </div>
);

export default Onboarding;
