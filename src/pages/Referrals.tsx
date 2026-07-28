import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { referralStatusLabel, type ReferralStatus } from "@/lib/demoBank";
import { ArrowLeft, Gift, Copy, Share2, UserPlus, CheckCircle2, Clock, Mail } from "lucide-react";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const statusStyle: Record<ReferralStatus, { chip: string; icon: typeof Clock }> = {
  invited: { chip: "bg-secondary text-muted-foreground", icon: Mail },
  signed_up: { chip: "bg-primary/10 text-primary", icon: Clock },
  completed: { chip: "bg-success/10 text-success", icon: CheckCircle2 },
};

const Referrals = () => {
  const navigate = useNavigate();
  const { referralCode, referralLink, referrals, inviteReferral } = useBank();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [inviting, setInviting] = useState(false);

  const earned = referrals
    .filter((r) => r.status === "completed" && r.bonusPaidAt)
    .reduce((s, r) => s + r.bonusAmount, 0);
  const pending = referrals.filter((r) => r.status !== "completed").length;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const share = async () => {
    const shareData = {
      title: "Glass Bank",
      text: `Join me on Glass Bank and we each get $20. Use my code ${referralCode}.`,
      url: referralLink,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* user cancelled — fall back to copying */
      }
    }
    void copy(referralLink, "Referral link");
  };

  const submitInvite = async () => {
    if (!name.trim()) return toast.error("Add a name for your invite");
    setInviting(true);
    const ok = await inviteReferral({ name: name.trim(), contact: contact.trim() });
    setInviting(false);
    if (ok) {
      setName("");
      setContact("");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-5 pt-14 space-y-5 pb-12">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center press" aria-label="Back">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div>
            <p className="kicker text-primary">Referrals</p>
            <h1 className="text-lg font-display font-bold text-foreground leading-tight">Give $20, get $20</h1>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <GlassCard elevated className="relative overflow-hidden space-y-3">
            <div className="absolute inset-0 gradient-hero opacity-[0.08] rounded-2xl" />
            <div className="relative space-y-3">
              <div className="flex items-center gap-2">
                <Gift size={16} className="text-primary" />
                <p className="text-sm font-semibold text-foreground">Your referral bonus</p>
              </div>
              <p className="text-serif-display text-4xl text-foreground tabular-nums">{money(earned)}</p>
              <p className="text-sm text-muted-foreground">
                Earned so far · {pending} invite{pending === 1 ? "" : "s"} still in progress
              </p>
              <p className="text-xs text-muted-foreground">
                Your friend gets $20 when they open an account and make their first deposit — and $20 lands in your
                checking the same day.
              </p>
            </div>
          </GlassCard>

          <GlassCard className="space-y-3">
            <p className="kicker text-muted-foreground">Your code</p>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3">
              <span className="text-lg font-display font-bold tracking-[0.2em] text-foreground">{referralCode || "—"}</span>
              <button onClick={() => copy(referralCode, "Referral code")} className="text-primary press" aria-label="Copy referral code">
                <Copy size={16} />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3">
              <span className="text-xs text-muted-foreground truncate">{referralLink}</span>
              <button onClick={() => copy(referralLink, "Referral link")} className="text-primary press shrink-0" aria-label="Copy referral link">
                <Copy size={16} />
              </button>
            </div>
            <button
              onClick={() => void share()}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 press"
            >
              <Share2 size={16} />
              Share your link
            </button>
          </GlassCard>

          <GlassCard className="space-y-3">
            <p className="kicker text-muted-foreground">Invite someone</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friend's name"
              className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none"
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email or phone (optional)"
              className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground outline-none"
            />
            <button
              onClick={() => void submitInvite()}
              disabled={inviting}
              className="w-full py-3.5 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2 press disabled:opacity-60"
            >
              <UserPlus size={16} />
              {inviting ? "Sending…" : "Track this invite"}
            </button>
          </GlassCard>

          <div className="space-y-2">
            <p className="kicker text-muted-foreground px-1">Your referrals</p>
            {referrals.length === 0 ? (
              <GlassCard className="text-center py-8">
                <p className="text-sm text-muted-foreground">No referrals yet — share your link to get started.</p>
              </GlassCard>
            ) : (
              referrals.map((r) => {
                const s = statusStyle[r.status];
                const Icon = s.icon;
                return (
                  <GlassCard key={r.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.contact || "No contact saved"} · invited {new Date(r.invitedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.status === "completed" && (
                        <span className="text-sm font-semibold text-success tabular-nums">+{money(r.bonusAmount)}</span>
                      )}
                      <span className={`text-[11px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${s.chip}`}>
                        <Icon size={12} />
                        {referralStatusLabel[r.status]}
                      </span>
                    </div>
                  </GlassCard>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Referrals;
