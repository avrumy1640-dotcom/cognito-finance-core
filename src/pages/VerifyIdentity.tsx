import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Loader2,
  Lock,
  Shield,
  Sparkles,
  IdCard,
  MapPin,
  Briefcase,
  UserIcon,
  ScanFace,
} from "lucide-react";
import KycStatusCard from "@/components/kyc/KycStatusCard";
import DocumentUploader from "@/components/kyc/DocumentUploader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useKyc } from "@/hooks/useKyc";

const ID_TYPE_MAP = { passport: 1, national_id: 2, drivers_license: 3 } as const;

const schema = z.object({
  legal_first_name: z.string().trim().min(1, "First name is required").max(60),
  legal_last_name: z.string().trim().min(1, "Last name is required").max(60),
  date_of_birth: z.string().refine((v) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return false;
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 18 && age < 120;
  }, "You must be at least 18 years old"),
  call_number: z.string().regex(/^\+[1-9]\d{4,14}$/, "Phone must be in +1XXXXXXXXXX format"),
  id_type: z.enum(["drivers_license", "passport", "national_id"]),
  id_number: z.string().trim().min(4, "Enter your ID number").max(40),
  id_issued_date: z.string().min(1, "Issued date is required"),
  id_expiration_date: z.string().min(1, "Expiration date is required"),
  street: z.string().trim().min(1, "Street is required").max(120),
  city: z.string().trim().min(1, "City is required").max(80),
  region: z.string().trim().min(2, "State is required").max(40),
  postal_code: z.string().trim().min(3, "ZIP required").max(20),
  country: z.string().length(2, "Use ISO country code"),
  citizenship: z.string().length(2, "Use ISO country code"),
  employment_status: z.enum([
    "employed", "self_employed", "unemployed", "student", "retired", "homemaker", "freelancer",
  ]),
  occupation: z.string().trim().min(1, "Occupation is required").max(80),
  income: z.string().regex(/^\d+$/, "Annual income (digits only)"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.literal(true, { errorMap: () => ({ message: "You must confirm the information is accurate" }) }),
});

type FormState = Omit<z.infer<typeof schema>, "confirm"> & { confirm: boolean };

const empty: FormState = {
  legal_first_name: "", legal_last_name: "", date_of_birth: "", call_number: "",
  id_type: "passport", id_number: "", id_issued_date: "", id_expiration_date: "",
  street: "", city: "", region: "", postal_code: "",
  country: "US", citizenship: "US",
  employment_status: "employed", occupation: "", income: "", password: "", confirm: false,
};

const ID_OPTIONS: { value: FormState["id_type"]; label: string; hint: string }[] = [
  { value: "passport", label: "Passport", hint: "Photo page" },
  { value: "drivers_license", label: "Driver's license", hint: "Front side" },
  { value: "national_id", label: "National ID", hint: "Government issued" },
];

const EMPLOYMENT: { value: FormState["employment_status"]; label: string }[] = [
  { value: "employed", label: "Employed" },
  { value: "self_employed", label: "Self-employed" },
  { value: "freelancer", label: "Freelancer" },
  { value: "student", label: "Student" },
  { value: "retired", label: "Retired" },
  { value: "homemaker", label: "Homemaker" },
  { value: "unemployed", label: "Unemployed" },
];

type StepDef = { title: string; kicker: string; valid: () => boolean; render: () => JSX.Element };

const VerifyIdentity = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, status, loading: kycLoading, refresh } = useKyc();
  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(empty);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        legal_first_name: profile.legal_first_name || f.legal_first_name,
        legal_last_name: profile.legal_last_name || f.legal_last_name,
      }));
    }
  }, [profile]);

  const readSelfie = (f: File) => {
    if (f.size > 6 * 1024 * 1024) { toast.error("Selfie must be under 6MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setSelfie(String(reader.result));
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!user) { toast.error("Sign in required"); return; }
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message ?? "Please review the form"); return; }
    if (!selfie) { toast.error("A selfie photo is required by our provider"); return; }
    setSubmitting(true);
    const d = parsed.data;

    const insertPayload = {
      user_id: user.id,
      legal_first_name: d.legal_first_name,
      legal_last_name: d.legal_last_name,
      date_of_birth: d.date_of_birth,
      ssn_last4: "0000",
      id_type: d.id_type,
      id_number_last4: d.id_number.replace(/\s+/g, "").slice(-4),
      street: d.street, city: d.city, region: d.region.toUpperCase(),
      postal_code: d.postal_code, country: d.country.toUpperCase(),
      employment_status: d.employment_status,
      status: "pending" as const,
      submitted_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase.from("kyc_profiles").upsert(insertPayload, { onConflict: "user_id" });
    if (upsertErr) { setSubmitting(false); toast.error(upsertErr.message); return; }

    toast.loading("Verifying your identity…", { id: "kyc" });
    const { data: result, error: fnErr } = await supabase.functions.invoke("iberbanco-kyc", {
      body: {
        first_name: d.legal_first_name, last_name: d.legal_last_name,
        email: user.email, password: d.password, call_number: d.call_number,
        date_of_birth: d.date_of_birth, address: d.street, city: d.city,
        state_or_province: d.region.toUpperCase(), post_code: d.postal_code,
        country: d.country.toUpperCase(), citizenship: d.citizenship.toUpperCase(),
        currencies: [1], selected_service: ["crypto", "card", "bank"],
        identity_card_type: ID_TYPE_MAP[d.id_type], identity_card_id: d.id_number,
        identityIssuedDate: d.id_issued_date, identityExpirationDate: d.id_expiration_date,
        employmentStatus: d.employment_status, income: d.income, occupation: d.occupation,
        selfie,
      },
    });
    setSubmitting(false);

    if (fnErr) {
      toast.error(fnErr.message ?? "Verification service unavailable", { id: "kyc" });
      await refresh();
      return;
    }
    const outcome = (result as { status?: string; reason?: string } | null)?.status ?? "pending";
    if (outcome === "verified") toast.success("Identity verified — your account is now active.", { id: "kyc" });
    else if (outcome === "rejected") toast.error((result as { reason?: string })?.reason ?? "Verification denied.", { id: "kyc" });
    else toast("Submitted — our team is reviewing your application.", { id: "kyc" });
    await refresh();
  };

  const steps = useMemo<StepDef[]>(() => [
    {
      kicker: "01 · Legal identity",
      title: "Let's confirm who you are",
      valid: () => !!form.legal_first_name && !!form.legal_last_name && !!form.date_of_birth && /^\+[1-9]\d{4,14}$/.test(form.call_number),
      render: () => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Legal first name" value={form.legal_first_name} onChange={(v) => set("legal_first_name", v)} />
            <Field label="Legal last name" value={form.legal_last_name} onChange={(v) => set("legal_last_name", v)} />
          </div>
          <Field label="Date of birth" type="date" value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} />
          <Field label="Phone (E.164)" placeholder="+15551234567" value={form.call_number} onChange={(v) => set("call_number", v)} />
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
            <Lock size={11} /> Must exactly match your government-issued ID.
          </p>
        </div>
      ),
    },
    {
      kicker: "02 · Identity document",
      title: "Which ID are you using?",
      valid: () => !!form.id_number && !!form.id_issued_date && !!form.id_expiration_date,
      render: () => (
        <div className="space-y-4">
          <div className="space-y-2">
            {ID_OPTIONS.map((o) => {
              const active = form.id_type === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => set("id_type", o.value)}
                  className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 text-left transition-all ${
                    active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-border/80"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
                    <IdCard size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">{o.label}</div>
                    <div className="text-xs text-muted-foreground">{o.hint}</div>
                  </div>
                  {active && <Check size={18} className="text-primary" />}
                </button>
              );
            })}
          </div>
          <Field label="ID number" value={form.id_number} onChange={(v) => set("id_number", v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issued on" type="date" value={form.id_issued_date} onChange={(v) => set("id_issued_date", v)} />
            <Field label="Expires on" type="date" value={form.id_expiration_date} onChange={(v) => set("id_expiration_date", v)} />
          </div>
        </div>
      ),
    },
    {
      kicker: "03 · Home address",
      title: "Where do you live?",
      valid: () => !!form.street && !!form.city && !!form.region && !!form.postal_code && form.country.length === 2 && form.citizenship.length === 2,
      render: () => (
        <div className="space-y-4">
          <Field label="Street address" value={form.street} onChange={(v) => set("street", v)} />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><Field label="City" value={form.city} onChange={(v) => set("city", v)} /></div>
            <Field label="State" value={form.region} onChange={(v) => set("region", v.toUpperCase())} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Postal" value={form.postal_code} onChange={(v) => set("postal_code", v)} />
            <Field label="Country" value={form.country} onChange={(v) => set("country", v.toUpperCase().slice(0, 2))} />
            <Field label="Citizenship" value={form.citizenship} onChange={(v) => set("citizenship", v.toUpperCase().slice(0, 2))} />
          </div>
        </div>
      ),
    },
    {
      kicker: "04 · Work & income",
      title: "A bit about your work",
      valid: () => !!form.occupation && /^\d+$/.test(form.income),
      render: () => (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1.5 block uppercase tracking-wide">Employment status</label>
            <div className="grid grid-cols-2 gap-2">
              {EMPLOYMENT.map((o) => {
                const active = form.employment_status === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => set("employment_status", o.value)}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      active ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Occupation" value={form.occupation} onChange={(v) => set("occupation", v)} />
          <Field label="Annual income (USD)" placeholder="50000" value={form.income} onChange={(v) => set("income", v.replace(/[^0-9]/g, ""))} />
        </div>
      ),
    },
    {
      kicker: "05 · Selfie & finish",
      title: "Take a quick selfie",
      valid: () => !!selfie && form.password.length >= 8 && form.confirm,
      render: () => (
        <div className="space-y-4">
          <DocumentUploader
            spec={{
              id: "selfie",
              label: "Live selfie",
              description: "We compare this to your ID photo to confirm it's really you.",
              kind: "selfie",
              maxMb: 6,
              minShortEdge: 480,
              tips: [
                "Face the camera straight-on with good lighting",
                "No hats, sunglasses, or masks",
                "Keep your whole face inside the frame",
              ],
            }}
            value={selfie}
            onChange={(url) => setSelfie(url)}
            rejectionReason={status === "rejected" ? profile?.rejection_reason ?? null : null}
            required
          />


          <Field label="Create account password" type="password" placeholder="At least 8 characters"
            value={form.password} onChange={(v) => set("password", v)} />

          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary cursor-pointer">
            <input type="checkbox" className="mt-0.5 accent-primary"
              checked={form.confirm} onChange={(e) => set("confirm", e.target.checked)} />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I certify the information above is accurate and consent to identity verification by our banking partner.
            </span>
          </label>
        </div>
      ),
    },
  ], [form, selfie]);

  const current = steps[step];

  const next = async () => {
    if (!current.valid()) { toast.error("Please complete this step to continue."); return; }
    if (step < steps.length - 1) setStep(step + 1);
    else await submit();
  };

  if (kycLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;
  }

  // Status surfaces (verified / pending / rejected) get the premium status card.
  if (status === "verified" || status === "pending") {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-5 pt-14 pb-8 space-y-5 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
              <ArrowLeft size={18} className="text-foreground" />
            </button>
            <h1 className="text-lg font-display font-bold text-foreground">Identity Verification</h1>
          </div>
          <KycStatusCard status={status} profile={profile} variant="full" onRetry={refresh} refreshing={kycLoading} />
        </div>
      </div>
    );
  }

  // Intro splash (mirrors Onboarding.tsx language)
  if (showIntro) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 gradient-hero" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent))_0%,transparent_45%)]" />
          <div className="relative z-10 h-full flex flex-col justify-between p-8 pt-16">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary-foreground/10 backdrop-blur border border-primary-foreground/20 flex items-center justify-center">
                <Shield size={16} className="text-primary-foreground" />
              </div>
              <span className="text-sm font-semibold text-primary-foreground/90 tracking-wide">IDENTITY VERIFICATION</span>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-foreground/10 backdrop-blur border border-primary-foreground/20 mb-4">
                <Sparkles size={12} className="text-primary-foreground" />
                <span className="text-[11px] font-semibold text-primary-foreground uppercase tracking-wider">Takes 2 minutes</span>
              </div>
              <h1 className="text-4xl font-display font-bold text-primary-foreground leading-[1.05] tracking-tight">
                Let's verify<br />it's really you.
              </h1>
              <p className="text-base text-primary-foreground/75 mt-4 leading-relaxed max-w-sm">
                Regulators require us to confirm your identity before you can move money. Your data is encrypted end-to-end.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="bg-card px-6 pt-6 pb-8 rounded-t-3xl -mt-6 relative z-20 shadow-2xl">
          <div className="space-y-3 mb-5">
            {[
              { icon: UserIcon, label: "Legal identity", desc: "Name, birthday, phone" },
              { icon: IdCard, label: "A photo of your ID", desc: "Passport or driver's license" },
              { icon: MapPin, label: "Your address", desc: "Where you legally reside" },
              { icon: Briefcase, label: "Work & income", desc: "For compliance requirements" },
              { icon: ScanFace, label: "A quick selfie", desc: "To match your ID photo" },
            ].map((it, i) => (
              <motion.div key={it.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }} className="flex items-center gap-3">
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
          {status === "rejected" && profile && (
            <div className="mb-4">
              <KycStatusCard status="rejected" profile={profile} variant="compact" onRetry={refresh} refreshing={kycLoading} />
            </div>
          )}
          <button
            onClick={() => setShowIntro(false)}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
          >
            {status === "rejected" ? "Update & resubmit" : "Start verification"} <ArrowRight size={16} />
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-3 flex items-center justify-center gap-1.5">
            <Lock size={11} /> Bank-grade encryption · Powered by our licensed partner
          </p>
        </div>
      </div>
    );
  }

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
                <motion.div className="h-full bg-primary" initial={false}
                  animate={{ width: i <= step ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: "easeOut" }} />
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
            <div className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-2">{current.kicker}</div>
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
          disabled={submitting}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> Submitting…</>
          ) : step === steps.length - 1 ? (
            <>Submit for verification <Check size={16} /></>
          ) : (
            <>Continue <ArrowRight size={16} /></>
          )}
        </button>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, placeholder, type }: {
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

export default VerifyIdentity;
