import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { UserPlus, Loader2, ShieldCheck, Eye, Users, X, Check } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import Seo from "@/components/Seo";
import ConfirmDialog from "@/components/glass/ConfirmDialog";
import { ledgerProvider, friendlyProviderMessage, type JointOverview } from "@/lib/ledgerProvider";

const ROLES = [
  { key: "admin", label: "Admin", desc: "See balances and move money", icon: ShieldCheck },
  { key: "viewer", label: "Viewer", desc: "See balances and activity only", icon: Eye },
  { key: "joint", label: "Joint owner", desc: "Full legal co-ownership of the account", icon: Users },
] as const;

const ROLE_LABEL: Record<string, string> = {
  primary: "Owner", joint: "Joint owner", admin: "Admin", viewer: "Viewer",
};

/**
 * Business team access.
 *
 * Built on the same invite-and-accept mechanism as joint accounts: access is
 * never granted unilaterally. Admin and Viewer are app-level permissions;
 * "Joint owner" additionally registers the person as a legal owner at the
 * banking partner.
 */
const Team = () => {
  const [data, setData] = useState<JointOverview | null>(null);
  const [accountId, setAccountId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "viewer" | "joint">("admin");
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ accountId: string; userId: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await ledgerProvider.jointList();
      setData(res);
      setAccountId((prev) => prev || res.accounts.find((a) => a.myRole === "primary")?.id || "");
    } catch (e) {
      toast.error(friendlyProviderMessage(e));
      setData({ incoming: [], outgoing: [], accounts: [] });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const invite = async () => {
    if (!accountId) return toast.error("Choose an account");
    setBusy("invite");
    try {
      const res = await ledgerProvider.jointRequest(accountId, email.trim(), role);
      toast.success(res.message);
      setEmail("");
      await load();
    } catch (e) { toast.error(friendlyProviderMessage(e)); }
    finally { setBusy(null); }
  };

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    try {
      await ledgerProvider.jointRespond(id, accept);
      toast.success(accept ? "Access accepted" : "Invitation declined");
      await load();
    } catch (e) { toast.error(friendlyProviderMessage(e)); }
    finally { setBusy(null); }
  };

  return (
    <AppLayout>
      <Seo title="Team access | Glass Bank" description="Give teammates admin or view-only access to your business accounts." path="/team" noindex />
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite teammates as admins or view-only. They must accept before anything is shared.
          </p>
        </motion.div>

        {!data && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>}

        {!!data?.incoming.length && (
          <div className="space-y-2">
            <h2 className="text-section-title px-1">Invitations for you</h2>
            {data.incoming.map((r) => (
              <GlassCard key={r.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.from}</p>
                  <p className="text-xs text-muted-foreground">invited you to an account</p>
                </div>
                <button onClick={() => respond(r.id, true)} disabled={!!busy}
                  className="min-h-10 px-3 rounded-xl bg-success/10 text-success text-xs font-semibold flex items-center gap-1">
                  <Check size={14} /> Accept
                </button>
                <button onClick={() => respond(r.id, false)} disabled={!!busy}
                  className="min-h-10 px-3 rounded-xl bg-secondary text-muted-foreground text-xs font-semibold flex items-center gap-1">
                  <X size={14} /> Decline
                </button>
              </GlassCard>
            ))}
          </div>
        )}

        {data && (
          <GlassCard className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Invite a teammate</p>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              aria-label="Account"
              className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {data.accounts.filter((a) => a.myRole === "primary").map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <input
              value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              placeholder="teammate@company.com"
              className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRole(r.key)}
                  aria-pressed={role === r.key}
                  className={`text-left p-3 rounded-2xl border transition-colors ${
                    role === r.key ? "border-primary bg-primary/5" : "border-border bg-secondary"
                  }`}
                >
                  <r.icon size={16} className="text-primary mb-1" />
                  <p className="text-xs font-semibold text-foreground">{r.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{r.desc}</p>
                </button>
              ))}
            </div>
            <button onClick={invite} disabled={busy === "invite"}
              className="w-full min-h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {busy === "invite" ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Send invitation
            </button>
          </GlassCard>
        )}

        {!!data?.outgoing.length && (
          <div className="space-y-2">
            <h2 className="text-section-title px-1">Pending invitations</h2>
            {data.outgoing.map((r) => (
              <GlassCard key={r.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.to}</p>
                  <p className="text-xs text-muted-foreground">{r.accountName} · {r.status}</p>
                </div>
                {r.status === "pending" && (
                  <button
                    onClick={async () => { await ledgerProvider.jointCancel(r.id); toast.success("Invitation canceled"); void load(); }}
                    className="text-xs font-semibold text-destructive"
                  >
                    Cancel
                  </button>
                )}
              </GlassCard>
            ))}
          </div>
        )}

        {data?.accounts.map((a) => (
          <div key={a.id} className="space-y-2">
            <h2 className="text-section-title px-1">{a.name} · people</h2>
            <GlassCard className="divide-y divide-border p-0 overflow-hidden">
              {a.owners.map((o) => (
                <div key={o.userId} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{o.name}{o.isMe && " (you)"}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABEL[o.role] ?? o.role}</p>
                  </div>
                  {a.myRole === "primary" && !o.isMe && (
                    <button
                      onClick={() => setRemoving({ accountId: a.id, userId: o.userId, name: o.name })}
                      className="text-xs font-semibold text-destructive"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </GlassCard>
          </div>
        ))}

        <ConfirmDialog
          open={!!removing}
          title={`Remove ${removing?.name ?? ""}?`}
          description="They'll immediately lose access to this account."
          confirmLabel="Remove"
          destructive
          onConfirm={async () => {
            if (!removing) return;
            try {
              await ledgerProvider.jointRemove(removing.accountId, removing.userId);
              toast.success("Access removed");
              await load();
            } catch (e) { toast.error(friendlyProviderMessage(e)); }
            setRemoving(null);
          }}
          onOpenChange={(v) => !v && setRemoving(null)}
        />
      </div>
    </AppLayout>
  );
};

export default Team;
