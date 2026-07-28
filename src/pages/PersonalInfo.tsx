import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import GlassCard from "@/components/glass/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  preferred_name: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  occupation: z.string().trim().max(120).optional().or(z.literal("")),
  employer: z.string().trim().max(120).optional().or(z.literal("")),
  annual_income: z.string().trim().max(40).optional().or(z.literal("")),
  citizenship: z.string().trim().max(80).optional().or(z.literal("")),
});

type FormState = z.infer<typeof schema>;

const EMPTY: FormState = {
  preferred_name: "",
  phone: "",
  email: "",
  occupation: "",
  employer: "",
  annual_income: "",
  citizenship: "",
};

const fields: { key: keyof FormState; label: string; type?: string; placeholder?: string }[] = [
  { key: "preferred_name", label: "Preferred Name", placeholder: "How you'd like to be addressed" },
  { key: "email", label: "Email", type: "email", placeholder: "you@example.com" },
  { key: "phone", label: "Phone", placeholder: "+1 555 123 4567" },
  { key: "citizenship", label: "Citizenship", placeholder: "United States" },
  { key: "occupation", label: "Occupation", placeholder: "Software Engineer" },
  { key: "employer", label: "Employer", placeholder: "Acme Inc." },
  { key: "annual_income", label: "Annual Income", placeholder: "$120,000" },
];

const PersonalInfo = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("preferred_name, phone, email, occupation, employer, annual_income, citizenship")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        toast.error("Couldn't load your profile", { description: error.message });
      } else if (data) {
        setForm({
          preferred_name: data.preferred_name ?? "",
          phone: data.phone ?? "",
          email: data.email ?? user.email ?? "",
          occupation: data.occupation ?? "",
          employer: data.employer ?? "",
          annual_income: data.annual_income ?? "",
          citizenship: data.citizenship ?? "",
        });
      } else {
        setForm((f) => ({ ...f, email: user.email ?? "" }));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    const payload = { user_id: user.id, ...parsed.data };
    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success("Profile updated");
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <h1 className="text-lg font-display font-bold text-foreground">Personal Information</h1>
        </div>

        <GlassCard className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="animate-spin mr-2" size={18} /> Loading…
            </div>
          ) : (
            fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">{f.label}</label>
                <input
                  type={f.type ?? "text"}
                  value={form[f.key] ?? ""}
                  onChange={update(f.key)}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2.5 rounded-lg bg-secondary/60 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            ))
          )}
        </GlassCard>

        <button
          onClick={save}
          disabled={loading || saving}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving && <Loader2 className="animate-spin" size={16} />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <p className="text-xs text-muted-foreground text-center">
          Legal name, date of birth, and SSN are managed through Identity Verification.
        </p>
      </div>
    </div>
  );
};

export default PersonalInfo;
