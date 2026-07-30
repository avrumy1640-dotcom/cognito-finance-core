import { useCallback, useEffect, useMemo, useReducer, useRef, ReactNode, KeyboardEvent } from "react";
import StepProgress from "@/components/StepProgress";
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
import DateOfBirthField from "@/components/form/DateOfBirthField";
import AddressAutocomplete from "@/components/form/AddressAutocomplete";



/* ============================================================================
 * Onboarding — reducer-driven state machine.
 *
 * Design contract (to prevent the class of bug we hit before):
 *   1. ONE reducer owns everything: step index, form data, saving flag,
 *      hydration flag. Nothing outside the reducer can mutate step index.
 *   2. Steps only advance on an explicit user action: Continue click or Enter
 *      submit on the form. No setTimeout auto-advance from option selection.
 *   3. Selecting an option (radio/choice) ONLY writes the field. It never
 *      dispatches NEXT.
 *   4. The Continue button is disabled unless the current step's validator
 *      returns null. That's the single source of truth for advance-ability.
 *   5. Data persists to `profiles` on every NEXT (best-effort) so a refresh
 *      resumes at the last completed step, hydrated from the row.
 * ========================================================================== */

type AccountType = "personal" | "business";

interface Data {
  account_type: AccountType | "";
  business_name: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  country: string;
  citizenship: string;
  address_street: string;
  address_line2: string;
  address_city: string;
  address_region: string;
  address_postal_code: string;
  occupation: string;
  employment_status: string;
  annual_income: string;
  source_of_funds: string;
  tax_id_number: string;
  tos: boolean;
  privacy: boolean;
}

const EMPTY: Data = {
  account_type: "",
  business_name: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  phone: "",
  country: "",
  citizenship: "",
  address_street: "",
  address_line2: "",
  address_city: "",
  address_region: "",
  address_postal_code: "",
  occupation: "",
  employment_status: "",
  annual_income: "",
  source_of_funds: "",
  tax_id_number: "",
  tos: false,
  privacy: false,
};

const COUNTRIES: [string, string, string][] = [
  ["US", "United States", "🇺🇸"], ["CA", "Canada", "🇨🇦"], ["GB", "United Kingdom", "🇬🇧"],
  ["DE", "Germany", "🇩🇪"], ["FR", "France", "🇫🇷"], ["ES", "Spain", "🇪🇸"],
  ["IT", "Italy", "🇮🇹"], ["NL", "Netherlands", "🇳🇱"], ["MX", "Mexico", "🇲🇽"],
  ["BR", "Brazil", "🇧🇷"], ["AU", "Australia", "🇦🇺"], ["JP", "Japan", "🇯🇵"],
  ["SG", "Singapore", "🇸🇬"], ["AE", "United Arab Emirates", "🇦🇪"],
];
const SOURCES = [
  "Employment income", "Business income", "Investment income", "Savings",
  "Sale of assets", "Inheritance / gift", "Retirement", "Other",
];
const EMPLOYMENT: { id: string; label: string }[] = [
  { id: "employed", label: "Employed" },
  { id: "self_employed", label: "Self-employed" },
  { id: "freelancer", label: "Freelancer" },
  { id: "student", label: "Student" },
  { id: "retired", label: "Retired" },
  { id: "homemaker", label: "Homemaker" },
  { id: "unemployed", label: "Unemployed" },
];
const ageFrom = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return NaN;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
};
const REQUIRES_TAX_ID = new Set(["US", "CA", "GB", "DE", "FR", "ES", "IT", "NL", "AU"]);
const DIAL_CODES: Record<string, string> = {
  US: "+1", CA: "+1", GB: "+44", DE: "+49", FR: "+33", ES: "+34", IT: "+39",
  NL: "+31", MX: "+52", BR: "+55", AU: "+61", JP: "+81", SG: "+65", AE: "+971",
};

/* ------------------------- Step config ------------------------------------ */

type Step = {
  id: string;
  kicker: string;
  title: string;
  subtitle?: string;
  /** Return null if the step's data is valid, else an error message. */
  validate: (d: Data) => string | null;
  render: (ctx: {
    data: Data;
    setField: <K extends keyof Data>(k: K, v: Data[K]) => void;
    submit: () => void;
  }) => ReactNode;
};

function buildSteps(data: Data): Step[] {
  const isBusiness = data.account_type === "business";
  const needsTax = REQUIRES_TAX_ID.has(data.country);
  const list: Step[] = [];
  let n = 0;
  const kicker = (label: string) => `${String(++n).padStart(2, "0")} · ${label}`;

  list.push({
    id: "account_type",
    kicker: kicker("Account"),
    title: "How will you use Glass Bank?",
    validate: (d) => (d.account_type ? null : "Choose Personal or Business to continue."),
    render: ({ data, setField }) => (
      <div className="space-y-3">
        {([
          { key: "personal", label: "Personal", icon: UserIcon, desc: "Everyday spending, saving, transfers" },
          { key: "business", label: "Business", icon: Building2, desc: "Company payments, payroll, invoicing" },
        ] as const).map((opt) => {
          const active = data.account_type === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setField("account_type", opt.key)}
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

  if (isBusiness) {
    list.push({
      id: "business_name",
      kicker: kicker("Business"),
      title: "What's your business called?",
      subtitle: "Use the exact legal name on your registration.",
      validate: (d) => (d.business_name.trim().length > 1 ? null : "Enter your legal business name."),
      render: ({ data, setField, submit }) => (
        <TextInput
          value={data.business_name}
          onChange={(v) => setField("business_name", v)}
          onEnter={submit}
          placeholder="Acme, Inc."
          autoComplete="organization"
        />
      ),
    });
  }

  list.push({
    id: "name",
    kicker: kicker("Name"),
    title: "What's your legal name?",
    subtitle: "Match your government-issued ID exactly — we use this to open your account.",
    validate: (d) =>
      d.first_name.trim().length > 0 && d.last_name.trim().length > 0
        ? null
        : "Enter both your first and last legal name.",
    render: ({ data, setField, submit }) => (
      <div className="space-y-3">
        <TextInput
          value={data.first_name}
          onChange={(v) => setField("first_name", v)}
          placeholder="First name"
          autoComplete="given-name"
        />
        <TextInput
          value={data.last_name}
          onChange={(v) => setField("last_name", v)}
          onEnter={submit}
          placeholder="Last name"
          autoComplete="family-name"
          autoFocus={false}
        />
      </div>
    ),
  });

  list.push({
    id: "dob",
    kicker: kicker("Birthday"),
    title: "When were you born?",
    subtitle: "You must be 18 or older to open an account.",
    validate: (d) => {
      if (!d.date_of_birth) return "Enter your date of birth.";
      const age = ageFrom(d.date_of_birth);
      if (Number.isNaN(age)) return "Enter a valid date.";
      if (age < 18) return "You must be at least 18 years old.";
      if (age >= 120) return "Enter a valid date of birth.";
      return null;
    },
    render: ({ data, setField, submit }) => (
      <DateOfBirthField
        value={data.date_of_birth}
        onChange={(v) => setField("date_of_birth", v)}
        onEnter={submit}
      />
    ),

  });

  list.push({
    id: "phone",
    kicker: kicker("Phone"),
    title: "What's your mobile number?",
    subtitle: "We use it for security codes and account alerts.",
    validate: (d) => {
      const digits = d.phone.replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15 ? null : "Enter a valid mobile number.";
    },
    render: ({ data, setField, submit }) => (
      <PhoneInput
        value={data.phone}
        defaultCountry={data.country || "US"}
        onChange={(v) => setField("phone", v)}
        onEnter={submit}
      />
    ),
  });

  list.push({
    id: "country",
    kicker: kicker("Country"),
    title: "Where do you live?",
    validate: (d) => (d.country ? null : "Choose your country of residence."),
    render: ({ data, setField }) => (
      <ChoiceList
        items={COUNTRIES.map(([c, l, flag]) => ({ id: c, label: l, prefix: flag }))}
        value={data.country}
        // Citizenship defaults to residence; the next step lets them change it.
        onChange={(v) => {
          setField("country", v);
          if (!data.citizenship) setField("citizenship", v);
        }}
      />
    ),
  });

  list.push({
    id: "citizenship",
    kicker: kicker("Citizenship"),
    title: "What's your citizenship?",
    subtitle: "Required by our banking partner for compliance screening.",
    validate: (d) => (d.citizenship ? null : "Choose your citizenship."),
    render: ({ data, setField }) => (
      <ChoiceList
        items={COUNTRIES.map(([c, l, flag]) => ({ id: c, label: l, prefix: flag }))}
        value={data.citizenship || data.country}
        onChange={(v) => setField("citizenship", v)}
      />
    ),
  });

  list.push({
    id: "address",
    kicker: kicker("Address"),
    title: "What's your address?",
    subtitle: "Where you receive mail today.",
    validate: (d) =>
      d.address_street.trim().length > 2 &&
      d.address_city.trim().length > 1 &&
      d.address_region.trim().length > 0 &&
      d.address_postal_code.trim().length > 2
        ? null
        : "Complete your street, city, state or region, and postal code.",
    render: ({ data, setField, submit }) => (
      <div className="space-y-3">
        <AddressAutocomplete
          label="Street address"
          value={data.address_street}
          onChange={(v) => setField("address_street", v)}
          onSelect={(s) => {
            setField("address_street", s.street || s.label);
            // Keep any unit the user already typed; only adopt the parsed one
            // when the unit field is still empty.
            if (s.unit && !data.address_line2.trim()) setField("address_line2", s.unit);
            if (s.city) setField("address_city", s.city);
            if (s.region) setField("address_region", s.region);
            if (s.postal_code) setField("address_postal_code", s.postal_code);
            if (s.country) setField("country", s.country);
          }}
          country={data.country || undefined}
          placeholder="Start typing your address"
        />
        <TextInput
          value={data.address_line2}
          onChange={(v) => setField("address_line2", v)}
          placeholder="Apt, suite or unit (optional)"
          autoComplete="address-line2"
          autoFocus={false}
        />
        <TextInput

          value={data.address_city}
          onChange={(v) => setField("address_city", v)}
          placeholder="City"
          autoComplete="address-level2"
          autoFocus={false}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            value={data.address_region}
            onChange={(v) => setField("address_region", v)}
            placeholder="State / region"
            autoComplete="address-level1"
            autoFocus={false}
          />
          <TextInput
            value={data.address_postal_code}
            onChange={(v) => setField("address_postal_code", v)}
            onEnter={submit}
            placeholder="Postal code"
            autoComplete="postal-code"
            autoFocus={false}
          />
        </div>
      </div>
    ),
  });

  list.push({
    id: "employment",
    kicker: kicker("Employment"),
    title: "What's your employment status?",
    validate: (d) => (d.employment_status ? null : "Choose your employment status."),
    render: ({ data, setField }) => (
      <ChoiceList
        items={EMPLOYMENT}
        value={data.employment_status}
        onChange={(v) => setField("employment_status", v)}
      />
    ),
  });

  list.push({
    id: "occupation",
    kicker: kicker("Work"),
    title: isBusiness ? "What does your business do?" : "What do you do for work?",
    validate: (d) => (d.occupation.trim().length > 1 ? null : "Enter your occupation."),
    render: ({ data, setField, submit }) => (
      <TextInput
        value={data.occupation}
        onChange={(v) => setField("occupation", v)}
        onEnter={submit}
        placeholder={isBusiness ? "Retail, SaaS, Consulting…" : "Software Engineer"}
      />
    ),
  });

  list.push({
    id: "income",
    kicker: kicker("Income"),
    title: "Estimated annual income?",
    subtitle: "Ballpark is fine — enter a whole number in USD.",
    validate: (d) => {
      const n = Number(d.annual_income.replace(/[^0-9]/g, ""));
      return n > 0 ? null : "Enter your estimated annual income.";
    },
    render: ({ data, setField, submit }) => (
      <TextInput
        inputMode="numeric"
        prefix="$"
        value={data.annual_income}
        onChange={(v) => setField("annual_income", v.replace(/[^0-9]/g, ""))}
        onEnter={submit}
        placeholder="120000"
      />
    ),
  });

  list.push({
    id: "source",
    kicker: kicker("Source of funds"),
    title: "Where will your money come from?",
    subtitle: "Helps us keep everyone's accounts safe.",
    validate: (d) => (d.source_of_funds ? null : "Choose your source of funds."),
    render: ({ data, setField }) => (
      <ChoiceList
        items={SOURCES.map((s) => ({ id: s, label: s }))}
        value={data.source_of_funds}
        onChange={(v) => setField("source_of_funds", v)}
      />
    ),
  });

  if (needsTax) {
    const isUs = data.country === "US";
    list.push({
      id: "tax_id",
      kicker: kicker(isUs ? "SSN" : "Tax ID"),
      title: isUs ? "What's your SSN or ITIN?" : "What's your tax ID number?",
      subtitle: "Encrypted end-to-end. Used only for regulatory reporting.",
      validate: (d) => (d.tax_id_number.trim().length > 3 ? null : "Enter your tax ID number."),
      render: ({ data, setField, submit }) => (
        <TextInput
          value={data.tax_id_number}
          onChange={(v) => setField("tax_id_number", v)}
          onEnter={submit}
          placeholder={isUs ? "•••-••-••••" : "Tax ID"}
          autoComplete="off"
          secure
        />
      ),
    });
  }

  list.push({
    id: "agreements",
    kicker: kicker("Agreements"),
    title: "Review and agree",
    subtitle: "One last step before we verify your identity.",
    validate: (d) => (d.tos && d.privacy ? null : "Agree to the Terms and Privacy Policy to finish."),
    render: ({ data, setField }) => (
      <div className="space-y-3">
        {[
          { key: "tos" as const, label: "Terms of Service", desc: "How Glass Bank works and what to expect from us." },
          { key: "privacy" as const, label: "Privacy Policy", desc: "How we collect, store, and protect your data." },
        ].map((it) => {
          const active = data[it.key];
          return (
            <label
              key={it.key}
              className={`w-full flex items-start gap-3 p-4 rounded-2xl text-left border-2 transition-all cursor-pointer ${
                active ? "border-primary bg-primary/5" : "border-border/60 bg-card"
              }`}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setField(it.key, e.target.checked)}
                className="sr-only"
                aria-label={`I agree to the ${it.label}`}
              />
              <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mt-0.5 shrink-0 ${active ? "border-primary bg-primary" : "border-border"}`}>
                {active && <Check size={14} className="text-primary-foreground" strokeWidth={3} />}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-foreground">I agree to the {it.label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{it.desc}</span>
              </span>
            </label>
          );
        })}
        <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Shield size={13} /> Bank-grade encryption. Your data stays yours.
        </div>
      </div>
    ),
  });

  return list;
}

/* ------------------------- Reducer ---------------------------------------- */

interface State {
  hydrated: boolean;
  showIntro: boolean;
  stepIndex: number;
  data: Data;
  saving: boolean;
  done: boolean;
}

type Action =
  | { type: "HYDRATE"; data: Partial<Data>; stepIndex: number; skipIntro: boolean }
  | { type: "DISMISS_INTRO" }
  | { type: "SET_FIELD"; key: keyof Data; value: Data[keyof Data] }
  | { type: "GOTO"; index: number }
  | { type: "SAVING"; on: boolean }
  | { type: "DONE" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...state,
        hydrated: true,
        data: { ...state.data, ...action.data },
        stepIndex: Math.max(0, action.stepIndex),
        showIntro: !action.skipIntro,
      };
    case "DISMISS_INTRO":
      return { ...state, showIntro: false };
    case "SET_FIELD":
      return { ...state, data: { ...state.data, [action.key]: action.value } };
    case "GOTO":
      return { ...state, stepIndex: Math.max(0, action.index) };
    case "SAVING":
      return { ...state, saving: action.on };
    case "DONE":
      return { ...state, done: true, saving: false };
    default:
      return state;
  }
}

/* ------------------------- Component -------------------------------------- */

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, {
    hydrated: false,
    showIntro: true,
    stepIndex: 0,
    data: EMPTY,
    saving: false,
    done: false,
  });

  const stepKey = user ? `gb:onboarding:step:${user.id}` : null;

  // Hydrate from profiles + saved step. Runs once per user.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;

      let hydrated: Partial<Data> = {};
      if (prof) {
        const pn: string = (prof.preferred_name || "").trim();
        const [first, ...rest] = pn.split(/\s+/);
        hydrated = {
          account_type: (prof.account_type as AccountType) || "",
          business_name: prof.business_name || "",
          first_name: first || "",
          last_name: rest.join(" ") || "",
          date_of_birth: prof.date_of_birth || "",
          phone: prof.phone || "",
          country: prof.country || "",
          citizenship: prof.citizenship || "",
          address_street: prof.address_street || "",
          address_line2: prof.address_line2 || "",
          address_city: prof.address_city || "",
          address_region: prof.address_region || "",
          address_postal_code: prof.address_postal_code || "",
          occupation: prof.occupation || "",
          employment_status: prof.employment_status || "",
          annual_income: (prof.annual_income || "").replace(/[^0-9]/g, ""),
          source_of_funds: prof.source_of_funds || "",
          tax_id_number: prof.tax_id_number || "",
          tos: !!prof.tos_accepted_at,
          privacy: !!prof.privacy_accepted_at,
        };
      }

      // Resume where they were.
      const stored = stepKey ? Number(localStorage.getItem(stepKey) || "0") : 0;
      const hasAnyData = Object.values(hydrated).some((v) => v !== "" && v !== false && v != null);
      dispatch({
        type: "HYDRATE",
        data: hydrated,
        stepIndex: isFinite(stored) ? stored : 0,
        skipIntro: hasAnyData || stored > 0,
      });
    })();
    return () => { cancelled = true; };
  }, [user, stepKey]);

  const steps = useMemo(() => buildSteps(state.data), [state.data]);
  const clampedIndex = Math.min(state.stepIndex, steps.length - 1);
  const current = steps[clampedIndex];
  const validationError = current?.validate(state.data) ?? null;
  const canContinue = validationError == null;
  const isLast = clampedIndex === steps.length - 1;

  // Persist step index whenever it changes.
  useEffect(() => {
    if (stepKey && state.hydrated) {
      localStorage.setItem(stepKey, String(clampedIndex));
    }
  }, [stepKey, clampedIndex, state.hydrated]);

  const setField = useCallback(<K extends keyof Data>(key: K, value: Data[K]) => {
    dispatch({ type: "SET_FIELD", key, value });
  }, []);

  const saveDraft = useCallback(async (d: Data) => {
    if (!user) return;
    // Best-effort partial save; ignore errors so a network blip doesn't block progress.
    await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        email: user.email,
        account_type: d.account_type || null,
        business_name: d.business_name || null,
        preferred_name: `${d.first_name} ${d.last_name}`.trim() || null,
        date_of_birth: d.date_of_birth || null,
        phone: d.phone || null,
        country: d.country || null,
        citizenship: d.citizenship || d.country || null,
        address_street: d.address_street || null,
        address_line2: d.address_line2.trim() || null,
        address_city: d.address_city || null,
        address_region: d.address_region || null,
        address_postal_code: d.address_postal_code || null,
        occupation: d.occupation || null,
        employment_status: d.employment_status || null,
        annual_income: d.annual_income || null,
        source_of_funds: d.source_of_funds || null,
        tax_country: d.country || null,
        tax_id_number: d.tax_id_number || null,
      },
      { onConflict: "user_id" },
    );
  }, [user]);

  const finish = useCallback(async () => {
    if (!user) return;
    dispatch({ type: "SAVING", on: true });
    const now = new Date().toISOString();
    const d = state.data;
    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        email: user.email,
        account_type: d.account_type,
        business_name: d.business_name || null,
        preferred_name: `${d.first_name} ${d.last_name}`.trim(),
        date_of_birth: d.date_of_birth,
        phone: d.phone,
        country: d.country,
        citizenship: d.citizenship || d.country,
        preferred_currency: "USD",
        address_street: d.address_street,
        address_line2: d.address_line2.trim() || null,
        address_city: d.address_city,
        address_region: d.address_region,
        address_postal_code: d.address_postal_code,
        occupation: d.occupation,
        employment_status: d.employment_status,
        annual_income: d.annual_income,
        source_of_funds: d.source_of_funds,
        tax_country: d.country || null,
        tax_id_number: d.tax_id_number || null,
        onboarded_at: now,
        tos_accepted_at: now,
        privacy_accepted_at: now,
      },
      { onConflict: "user_id" },
    );
    if (error) {
      dispatch({ type: "SAVING", on: false });
      toast.error(error.message);
      return;
    }
    if (stepKey) localStorage.removeItem(stepKey);
    dispatch({ type: "DONE" });
    setTimeout(() => navigate("/profile/verify", { replace: true }), 1400);
  }, [user, state.data, stepKey, navigate]);

  // The ONE and only advance handler. Called from Continue click or Enter key.
  const submit = useCallback(() => {
    if (state.saving) return;
    const step = steps[Math.min(state.stepIndex, steps.length - 1)];
    if (!step) return;
    const err = step.validate(state.data);
    if (err) {
      toast.error(err);
      return;
    }
    if (state.stepIndex >= steps.length - 1) {
      void finish();
      return;
    }
    void saveDraft(state.data);
    dispatch({ type: "GOTO", index: state.stepIndex + 1 });
  }, [state.saving, state.stepIndex, state.data, steps, finish, saveDraft]);

  const back = useCallback(() => {
    if (state.saving) return;
    if (state.stepIndex === 0) {
      // From step 0, back returns to intro if we haven't yet started.
      navigate("/welcome");
      return;
    }
    dispatch({ type: "GOTO", index: state.stepIndex - 1 });
  }, [state.saving, state.stepIndex, navigate]);

  /* ------- render states ------- */

  if (!state.hydrated) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (state.done) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="w-24 h-24 rounded-full gradient-hero flex items-center justify-center shadow-xl mb-6"
        >
          <Check size={44} className="text-primary-foreground" strokeWidth={3} />
        </motion.div>
        <h1 className="text-3xl font-display font-bold text-foreground text-center">
          You're all set{state.data.first_name ? `, ${state.data.first_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-2 text-center max-w-xs">
          Taking you to identity verification to unlock your account…
        </p>
      </div>
    );
  }

  if (state.showIntro) {
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <div className="flex-1 relative overflow-hidden w-full max-w-xl mx-auto">
          <div className="absolute inset-0 gradient-hero" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent))_0%,transparent_45%)]" />
          <div className="relative z-10 h-full flex flex-col justify-between p-8 pt-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary-foreground/10 backdrop-blur border border-primary-foreground/20 flex items-center justify-center">
                <span className="text-lg font-display font-bold text-primary-foreground">G</span>
              </div>
              <span className="text-sm font-semibold text-primary-foreground/90 tracking-wide">GLASS BANK</span>
            </div>
            <div>
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
            </div>
          </div>
        </div>
        <div className="bg-card px-6 pt-6 pb-8 rounded-t-3xl -mt-6 relative z-20 shadow-2xl">
          <div className="space-y-3 mb-5">
            {[
              { icon: UserIcon, label: "Tell us about yourself", desc: "Name, contact, and address" },
              { icon: Building2, label: "A bit about your work", desc: "Occupation and income" },
              { icon: Shield, label: "Verify your identity", desc: "Fast, encrypted, and secure" },
            ].map((it) => (
              <div key={it.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <it.icon size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{it.label}</div>
                  <div className="text-xs text-muted-foreground">{it.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "DISMISS_INTRO" })}
            data-testid="intro-start"
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

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      className="min-h-dvh bg-background flex flex-col"
    >
      <div className="px-5 pt-6 pb-4 sticky top-0 bg-background/95 backdrop-blur z-10 w-full max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={back}
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft size={18} className="text-foreground" />
          </button>
          <StepProgress
            className="flex-1"
            index={clampedIndex}
            total={steps.length}
            label={current.kicker.replace(/^\d+\s·\s/, "")}
          />
        </div>
      </div>

      <div className="flex-1 px-5 pb-6 w-full max-w-xl mx-auto">
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
            {current.render({ data: state.data, setField, submit })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-5 pb-8 pt-3 sticky bottom-0 w-full max-w-xl mx-auto bg-gradient-to-t from-background via-background to-background/0 space-y-2">
        <button
          type="submit"
          data-testid="onboarding-continue"
          disabled={!canContinue || state.saving}
          aria-disabled={!canContinue || state.saving}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
        >
          {state.saving ? (
            <><Loader2 size={16} className="animate-spin" /> Saving…</>
          ) : isLast ? (
            <>Finish & verify identity <Check size={16} /></>
          ) : (
            <>Continue <ArrowRight size={16} /></>
          )}
        </button>
      </div>
    </form>
  );
};

/* ------------------------- Reusable inputs -------------------------------- */

const TextInput = ({
  value, onChange, onEnter, placeholder, autoComplete, autoFocus = true, secure = false,
  type, max, inputMode, prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  secure?: boolean;
  type?: string;
  max?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  /** Static adornment rendered inside the field (e.g. a currency symbol). */
  prefix?: string;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => ref.current?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Let the enclosing <form> handle submission via its onSubmit; we call
      // onEnter as a hint when the last input on a multi-field step should
      // advance. For a single-input step, both paths converge on submit().
      if (onEnter) { e.preventDefault(); onEnter(); }
    }
  };

  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        type={secure ? "password" : type ?? "text"}
        max={max}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`w-full py-5 rounded-2xl bg-secondary text-foreground text-lg border-2 border-transparent outline-none focus:border-primary/50 focus:bg-card transition-all placeholder:text-muted-foreground/60 ${prefix ? "pl-9 pr-4" : "px-4"}`}
      />
    </div>
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
          type="button"
          key={it.id}
          data-testid={`choice-${it.id}`}
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
  const parsed = useMemo(() => {
    const raw = (value || "").trim();
    if (raw.startsWith("+")) {
      const digits = raw.replace(/\D/g, "");
      const entries = Object.entries(DIAL_CODES).sort((a, b) => b[1].length - a[1].length);
      for (const [cc, dial] of entries) {
        const d = dial.replace(/\D/g, "");
        if (digits.startsWith(d)) return { country: cc, dial, local: digits.slice(d.length) };
      }
      return { country: defaultCountry, dial: DIAL_CODES[defaultCountry] || "+1", local: digits };
    }
    return { country: defaultCountry, dial: DIAL_CODES[defaultCountry] || "+1", local: raw.replace(/\D/g, "") };
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

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="px-3 py-5 rounded-2xl bg-secondary text-foreground text-base font-semibold flex items-center gap-1.5 shrink-0">
          <span className="text-xl leading-none">
            {COUNTRIES.find((c) => c[0] === parsed.country)?.[2] || "🌐"}
          </span>
          <span className="tabular-nums">{parsed.dial}</span>
        </div>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={parsed.local}
          onChange={(e) => emit(parsed.country, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onEnter(); } }}
          placeholder="555 123 4567"
          className="flex-1 min-w-0 px-4 py-5 rounded-2xl bg-secondary text-foreground text-lg border-2 border-transparent outline-none focus:border-primary/50 focus:bg-card transition-all placeholder:text-muted-foreground/60"
        />
      </div>
      <p className="text-xs text-muted-foreground px-1">
        We'll text a verification code to this number.
      </p>
    </div>
  );
};

export default Onboarding;
