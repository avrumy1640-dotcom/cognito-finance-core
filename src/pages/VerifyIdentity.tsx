import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, ShieldCheck, Clock, ShieldAlert } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useKyc } from "@/hooks/useKyc";

const schema = z.object({
  legal_first_name: z.string().trim().min(1, "First name is required").max(60),
  legal_last_name: z.string().trim().min(1, "Last name is required").max(60),
  date_of_birth: z.string().refine((v) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return false;
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 18 && age < 120;
  }, "You must be at least 18 years old"),
  ssn_full: z.string().regex(/^\d{3}-?\d{2}-?\d{4}$/, "Enter a 9-digit SSN"),
  id_type: z.enum(["drivers_license", "passport", "state_id"]),
  id_number: z.string().trim().min(4, "Enter your ID number").max(40),
  street: z.string().trim().min(1, "Street is required").max(120),
  city: z.string().trim().min(1, "City is required").max(80),
  region: z.string().trim().min(2, "State is required").max(40),
  postal_code: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
  country: z.literal("US"),
  employment_status: z.enum(["employed", "self_employed", "student", "retired", "unemployed"]),
  confirm: z.literal(true, { errorMap: () => ({ message: "You must confirm the information is accurate" }) }),
});

type FormState = {
  legal_first_name: string;
  legal_last_name: string;
  date_of_birth: string;
  ssn_full: string;
  id_type: "drivers_license" | "passport" | "state_id";
  id_number: string;
  street: string;
  city: string;
  region: string;
  postal_code: string;
  country: "US";
  employment_status: "employed" | "self_employed" | "student" | "retired" | "unemployed";
  confirm: boolean;
};

const emptyForm: FormState = {
  legal_first_name: "",
  legal_last_name: "",
  date_of_birth: "",
  ssn_full: "",
  id_type: "drivers_license",
  id_number: "",
  street: "",
  city: "",
  region: "",
  postal_code: "",
  country: "US",
  employment_status: "employed",
  confirm: false,
};

const VerifyIdentity = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, status, loading: kycLoading, refresh } = useKyc();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!user) { toast.error("Sign in required"); return; }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Please review the form");
      return;
    }
    setSubmitting(true);
    const d = parsed.data;
    const ssnDigits = d.ssn_full.replace(/-/g, "");
    const payload = {
      user_id: user.id,
      legal_first_name: d.legal_first_name,
      legal_last_name: d.legal_last_name,
      date_of_birth: d.date_of_birth,
      ssn_last4: ssnDigits.slice(-4),
      id_type: d.id_type,
      id_number_last4: d.id_number.replace(/\s+/g, "").slice(-4),
      street: d.street,
      city: d.city,
      region: d.region.toUpperCase(),
      postal_code: d.postal_code,
      country: d.country,
      employment_status: d.employment_status,
      status: "pending" as const,
      submitted_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("kyc_profiles")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      setSubmitting(false);
      toast.error(error.message);
      return;
    }

    // Simulated review: auto-verify after a short delay (demo BaaS behavior).
    toast.loading("Reviewing your information…", { id: "kyc" });
    await new Promise((r) => setTimeout(r, 1600));
    const { error: reviewErr } = await supabase
      .from("kyc_profiles")
      .update({ status: "verified", reviewed_at: new Date().toISOString() })
      .eq("user_id", user.id);
    setSubmitting(false);

    if (reviewErr) {
      toast.error(reviewErr.message, { id: "kyc" });
      return;
    }
    toast.success("Identity verified — your account is now active.", { id: "kyc" });
    await refresh();
  };

  // If already verified/pending, prefill display
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
            <p className="text-sm">Your submission is under review.</p>
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
              We need to verify your identity before your account can move funds. Information is stored on your account only.
              Only the last 4 digits of your SSN and ID are retained.
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
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">SSN</label>
                  <input
                    inputMode="numeric"
                    maxLength={11}
                    placeholder="123-45-6789"
                    className={inputCls}
                    value={form.ssn_full}
                    onChange={(e) => set("ssn_full", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">ID type</label>
                  <select className={inputCls} value={form.id_type} onChange={(e) => set("id_type", e.target.value as FormState["id_type"])}>
                    <option value="drivers_license">Driver's license</option>
                    <option value="state_id">State ID</option>
                    <option value="passport">US passport</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">ID number</label>
                  <input className={inputCls} value={form.id_number} onChange={(e) => set("id_number", e.target.value)} />
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
                  <input maxLength={2} className={inputCls} value={form.region} onChange={(e) => set("region", e.target.value.toUpperCase())} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">ZIP code</label>
                <input inputMode="numeric" maxLength={10} className={inputCls} value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Employment status</label>
                <select className={inputCls} value={form.employment_status} onChange={(e) => set("employment_status", e.target.value as FormState["employment_status"])}>
                  <option value="employed">Employed</option>
                  <option value="self_employed">Self-employed</option>
                  <option value="student">Student</option>
                  <option value="retired">Retired</option>
                  <option value="unemployed">Unemployed</option>
                </select>
              </div>

              <label className="flex items-start gap-2 pt-2 text-xs text-muted-foreground">
                <input type="checkbox" className="mt-0.5" checked={form.confirm} onChange={(e) => set("confirm", e.target.checked)} />
                <span>I certify the information above is accurate. I consent to identity verification under the USA PATRIOT Act.</span>
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
