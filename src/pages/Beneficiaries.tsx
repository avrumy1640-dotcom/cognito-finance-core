import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowLeft, Plus, Search, Star, StarOff, Trash2, Send, Building2, Globe2, Loader2,
} from "lucide-react";
import GlassCard from "@/components/glass/GlassCard";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Beneficiary = {
  id: string;
  nickname: string;
  full_name: string;
  kind: string;
  bank_name: string | null;
  routing_number: string | null;
  account_number_last4: string | null;
  swift_bic: string | null;
  iban: string | null;
  country: string | null;
  email: string | null;
  memo: string | null;
  favorite: boolean;
  last_used_at: string | null;
};

const schema = z.object({
  nickname: z.string().trim().min(1).max(50),
  full_name: z.string().trim().min(2).max(120),
  kind: z.enum(["ach", "wire", "internal", "crypto"]),
  bank_name: z.string().trim().max(120).optional().or(z.literal("")),
  routing_number: z.string().trim().max(20).optional().or(z.literal("")),
  account_number: z.string().trim().max(34).optional().or(z.literal("")),
  swift_bic: z.string().trim().max(11).optional().or(z.literal("")),
  iban: z.string().trim().max(34).optional().or(z.literal("")),
  country: z.string().trim().max(2).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  memo: z.string().trim().max(200).optional().or(z.literal("")),
});

const kindLabel: Record<string, string> = {
  ach: "US ACH",
  wire: "Wire",
  internal: "Glass Bank",
  crypto: "Crypto",
};

const Beneficiaries = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Beneficiary[] | null>(null);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nickname: "", full_name: "", kind: "ach" as "ach"|"wire"|"internal"|"crypto",
    bank_name: "", routing_number: "", account_number: "",
    swift_bic: "", iban: "", country: "", email: "", memo: "",
  });

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("beneficiaries")
      .select("*")
      .order("favorite", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as Beneficiary[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      r.nickname.toLowerCase().includes(t) ||
      r.full_name.toLowerCase().includes(t) ||
      (r.bank_name ?? "").toLowerCase().includes(t)
    );
  }, [rows, q]);

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!user) return;
    setSaving(true);
    const acct = form.account_number.trim();
    const { error } = await supabase.from("beneficiaries").insert({
      user_id: user.id,
      nickname: parsed.data.nickname,
      full_name: parsed.data.full_name,
      kind: parsed.data.kind,
      bank_name: form.bank_name || null,
      routing_number: form.routing_number || null,
      account_number_last4: acct ? acct.slice(-4) : null,
      swift_bic: form.swift_bic || null,
      iban: form.iban || null,
      country: form.country ? form.country.toUpperCase() : null,
      email: form.email || null,
      memo: form.memo || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Beneficiary saved");
    setShowForm(false);
    setForm({ ...form, nickname: "", full_name: "", bank_name: "", routing_number: "", account_number: "", swift_bic: "", iban: "", country: "", email: "", memo: "" });
    load();
  };

  const toggleFavorite = async (b: Beneficiary) => {
    await supabase.from("beneficiaries").update({ favorite: !b.favorite }).eq("id", b.id);
    load();
  };
  const remove = async (b: Beneficiary) => {
    if (!confirm(`Remove ${b.nickname}?`)) return;
    await supabase.from("beneficiaries").delete().eq("id", b.id);
    toast.success("Removed");
    load();
  };
  const payNow = (b: Beneficiary) => {
    const dest = b.kind === "wire" ? "wire" : b.kind === "internal" ? "transfer" : "external";
    navigate(`/move-money/${dest}?beneficiary=${b.id}`);
  };

  return (
    <AppLayout>
      <div className="px-5 pt-6 pb-8 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-muted-foreground" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold text-foreground">Beneficiaries</h1>
            <p className="text-sm text-muted-foreground">Save payees for quick, repeat payments</p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
            aria-label="Add"
          >
            <Plus size={18} />
          </button>
        </div>

        {showForm && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {(["ach","wire","internal","crypto"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setForm({ ...form, kind: k })}
                    className={`py-2 rounded-lg text-xs font-medium ${
                      form.kind === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {kindLabel[k]}
                  </button>
                ))}
              </div>
              <Field label="Nickname">
                <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className={input} placeholder="Mom" />
              </Field>
              <Field label="Full legal name">
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={input} placeholder="Jane Doe" />
              </Field>
              {form.kind === "ach" && (
                <>
                  <Field label="Bank name"><input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className={input} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Routing"><input value={form.routing_number} onChange={(e) => setForm({ ...form, routing_number: e.target.value })} className={input} /></Field>
                    <Field label="Account"><input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className={input} /></Field>
                  </div>
                </>
              )}
              {form.kind === "wire" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="SWIFT/BIC"><input value={form.swift_bic} onChange={(e) => setForm({ ...form, swift_bic: e.target.value })} className={input} /></Field>
                    <Field label="Country (ISO2)"><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={input} maxLength={2} /></Field>
                  </div>
                  <Field label="IBAN / account"><input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} className={input} /></Field>
                </>
              )}
              {form.kind === "internal" && (
                <Field label="Recipient email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} placeholder="friend@glassbank.com" /></Field>
              )}
              {form.kind === "crypto" && (
                <Field label="Wallet address"><input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} className={input} placeholder="0x…" /></Field>
              )}
              <Field label="Memo (optional)"><input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={input} /></Field>
              <button onClick={save} disabled={saving} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {saving && <Loader2 size={14} className="animate-spin" />} Save beneficiary
              </button>
            </GlassCard>
          </motion.div>
        )}

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search beneficiaries" className="w-full pl-9 pr-3 py-3 rounded-xl bg-secondary text-sm outline-none" />
        </div>

        {rows === null ? (
          <GlassCard className="text-center py-6 text-sm text-muted-foreground">Loading…</GlassCard>
        ) : filtered.length === 0 ? (
          <GlassCard className="text-center py-8 text-sm text-muted-foreground">
            No beneficiaries yet. Add one to send money faster.
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {filtered.map((b) => (
              <GlassCard key={b.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {b.kind === "wire" ? <Globe2 size={18} /> : <Building2 size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{b.nickname}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{kindLabel[b.kind] ?? b.kind}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.full_name}
                    {b.account_number_last4 ? ` · •••• ${b.account_number_last4}` : ""}
                    {b.bank_name ? ` · ${b.bank_name}` : ""}
                  </p>
                </div>
                <button onClick={() => toggleFavorite(b)} className="p-1.5 text-muted-foreground" aria-label="Favorite">
                  {b.favorite ? <Star size={16} className="fill-amber-500 text-amber-500" /> : <StarOff size={16} />}
                </button>
                <button onClick={() => payNow(b)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1">
                  <Send size={12} /> Pay
                </button>
                <button onClick={() => remove(b)} className="p-1.5 text-muted-foreground" aria-label="Delete">
                  <Trash2 size={16} />
                </button>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

const input = "w-full p-2.5 rounded-lg bg-secondary text-sm outline-none";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
    {children}
  </div>
);

export default Beneficiaries;
