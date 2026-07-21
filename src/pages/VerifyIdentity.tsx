import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, ShieldCheck, Clock, ShieldAlert, Camera } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
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

const emptyForm: FormState = {
  legal_first_name: "",
  legal_last_name: "",
  date_of_birth: "",
  call_number: "",
  id_type: "passport",
  id_number: "",
  id_issued_date: "",
  id_expiration_date: "",
  street: "",
  city: "",
  region: "",
  postal_code: "",
  country: "US",
  citizenship: "US",
  employment_status: "employed",
  occupation: "",
  income: "",
  password: "",
  confirm: false,
};

const VerifyIdentity = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, status, loading: kycLoading, refresh } = useKyc();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const readSelfie = (f: File) => {
    if (f.size > 6 * 1024 * 1024) { toast.error("Selfie must be under 6MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setSelfie(String(reader.result));
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!user) { toast.error("Sign in required"); return; }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Please review the form");
      return;
    }
    if (!selfie) { toast.error("A selfie photo is required by our provider"); return; }
    setSubmitting(true);
    const d = parsed.data;

    // Persist redacted profile row first so the pending state exists even if
    // the provider call is slow or errors mid-flight.
    const insertPayload = {
      user_id: user.id,
      legal_first_name: d.legal_first_name,
      legal_last_name: d.legal_last_name,
      date_of_birth: d.date_of_birth,
      ssn_last4: "0000", // not collected by Iberbanco personal flow
      id_type: d.id_type,
      id_number_last4: d.id_number.replace(/\s+/g, "").slice(-4),
      street: d.street,
      city: d.city,
      region: d.region.toUpperCase(),
      postal_code: d.postal_code,
      country: d.country.toUpperCase(),
      employment_status: d.employment_status,
      status: "pending" as const,
      submitted_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await supabase
      .from("kyc_profiles")
      .upsert(insertPayload, { onConflict: "user_id" });

    if (upsertErr) {
      setSubmitting(false);
      toast.error(upsertErr.message);
      return;
    }

    toast.loading("Verifying your identity…", { id: "kyc" });

    const { data: result, error: fnErr } = await supabase.functions.invoke("iberbanco-kyc", {
      body: {
        first_name: d.legal_first_name,
        last_name: d.legal_last_name,
        email: user.email,
        password: d.password,
        call_number: d.call_number,
        date_of_birth: d.date_of_birth,
        address: d.street,
        city: d.city,
        state_or_province: d.region.toUpperCase(),
        post_code: d.postal_code,
        country: d.country.toUpperCase(),
        citizenship: d.citizenship.toUpperCase(),
        currencies: [1],
        selected_service: ["crypto", "card", "bank"],
        identity_card_type: ID_TYPE_MAP[d.id_type],
        identity_card_id: d.id_number,
        identityIssuedDate: d.id_issued_date,
        identityExpirationDate: d.id_expiration_date,
        employmentStatus: d.employment_status,
        income: d.income,
        occupation: d.occupation,
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
    if (outcome === "verified") {
      toast.success("Identity verified — your account is now active.", { id: "kyc" });
    } else if (outcome === "rejected") {
      toast.error(
        (result as { reason?: string })?.reason ?? "Verification was denied. Please review your details and try again.",
        { id: "kyc" },
      );
    } else {
      toast("Submitted — Iberbanco is reviewing your application.", { id: "kyc" });
    }
    await refresh();
  };

  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        legal_first_name: profile.legal_first_name,
        legal_last_name: profile.legal_last_name,
      }));
    }
  }, [profile]);

  if (kycLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (status === "verified") {
    return (
      <AppLayout>
        <div className="px-5 pt-14 space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <ArrowLeft size={20} className="text-foreground" />
            </button>
            <h1 className="text-lg font-display font-bold text-foreground">Identity Verification</h1>
          </div>
          <GlassCard elevated className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-success/10 mx-auto flex items-center justify-center mb-3">
              <ShieldCheck size={28} className="text-success" />
            </div>
            <h2 className="text-lg font-display font-bold text-foreground">You're verified</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Verified as {profile?.legal_first_name} {profile?.legal_last_name}. All money-movement features are unlocked.
            </p>
            <button onClick={() => navigate("/")} className="mt-5 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
              Back to home
            </button>
          </GlassCard>
        </div>
      </AppLayout>
    );
  }

  const inputCls = "w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none";

  return (
    <AppLayout>
      <div className="px-5 pt-14 space-y-5 pb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h1 className="text-lg font-display font-bold text-foreground">Identity Verification</h1>
        </div>

        {status === "pending" && (
          <div className="rounded-2xl p-4 bg-primary/10 text-primary flex items-start gap-3">
            <Clock size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm">Your submission is under review by Iberbanco.</p>
          </div>
        )}
        {status === "rejected" && (
          <div className="rounded-2xl p-4 bg-destructive/10 text-destructive flex items-start gap-3">
            <ShieldAlert size={20} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Verification failed</p>
              <p className="text-xs mt-1 opacity-90">{profile?.rejection_reason ?? "Please double-check your information and resubmit."}</p>
            </div>
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard elevated>
            <p className="text-sm text-muted-foreground mb-4">
              Verification is performed by Iberbanco. Your data is transmitted directly to the provider and is never stored in plain text on this device.
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Legal first name</label>
                  <input className={inputCls} value={form.legal_first_name} onChange={(e) => set("legal_first_name", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Legal last name</label>
                  <input className={inputCls} value={form.legal_last_name} onChange={(e) => set("legal_last_name", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Date of birth</label>
                  <input type="date" className={inputCls} value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Phone (E.164)</label>
                  <input placeholder="+15551234567" className={inputCls} value={form.call_number} onChange={(e) => set("call_number", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">ID type</label>
                  <select className={inputCls} value={form.id_type} onChange={(e) => set("id_type", e.target.value as FormState["id_type"])}>
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID</option>
                    <option value="drivers_license">Driver's license</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">ID number</label>
                  <input className={inputCls} value={form.id_number} onChange={(e) => set("id_number", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">ID issued</label>
                  <input type="date" className={inputCls} value={form.id_issued_date} onChange={(e) => set("id_issued_date", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">ID expires</label>
                  <input type="date" className={inputCls} value={form.id_expiration_date} onChange={(e) => set("id_expiration_date", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Street address</label>
                <input className={inputCls} value={form.street} onChange={(e) => set("street", e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">City</label>
                  <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">State</label>
                  <input maxLength={40} className={inputCls} value={form.region} onChange={(e) => set("region", e.target.value.toUpperCase())} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">ZIP / Postal</label>
                  <input inputMode="numeric" maxLength={10} className={inputCls} value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Country</label>
                  <input maxLength={2} className={inputCls} value={form.country} onChange={(e) => set("country", e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Citizenship</label>
                  <input maxLength={2} className={inputCls} value={form.citizenship} onChange={(e) => set("citizenship", e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Employment</label>
                  <select className={inputCls} value={form.employment_status} onChange={(e) => set("employment_status", e.target.value as FormState["employment_status"])}>
                    <option value="employed">Employed</option>
                    <option value="self_employed">Self-employed</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="student">Student</option>
                    <option value="retired">Retired</option>
                    <option value="homemaker">Homemaker</option>
                    <option value="unemployed">Unemployed</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Occupation</label>
                  <input className={inputCls} value={form.occupation} onChange={(e) => set("occupation", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Annual income</label>
                  <input inputMode="numeric" className={inputCls} value={form.income} onChange={(e) => set("income", e.target.value.replace(/[^0-9]/g, ""))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Account password</label>
                  <input type="password" className={inputCls} value={form.password} onChange={(e) => set("password", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Selfie</label>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm flex items-center gap-2"
                >
                  <Camera size={16} />
                  {selfie ? "Selfie attached — tap to replace" : "Upload a selfie photo"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && readSelfie(e.target.files[0])}
                />
              </div>

              <label className="flex items-start gap-2 pt-2 text-xs text-muted-foreground">
                <input type="checkbox" className="mt-0.5" checked={form.confirm} onChange={(e) => set("confirm", e.target.checked as any)} />
                <span>I certify the information above is accurate and consent to identity verification by Iberbanco.</span>
              </label>

              <button
                onClick={submit}
                disabled={submitting}
                className="w-full mt-2 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit for verification"}
              </button>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default VerifyIdentity;
