import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, Users, Check, X, Loader2, ShieldCheck, LogOut } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import EmptyState from "@/components/glass/EmptyState";
import ConfirmDialog from "@/components/glass/ConfirmDialog";
import Seo from "@/components/Seo";
import { ledgerProvider, friendlyProviderMessage, type JointOverview } from "@/lib/ledgerProvider";

/**
 * Joint accounts.
 *
 * A joint owner is a SECOND verified customer added to the same provider bank
 * account. The invite is never unilateral: the primary owner sends a request,
 * and only the invitee's own acceptance grants access.
 */
const JointAccounts = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<JointOverview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [accountId, setAccountId] = useState("");
  const [email, setEmail] = useState("");
  const [leaving, setLeaving] = useState<{ accountId: string; userId?: string; name: string } | null>(null);

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

  const sendRequest = async () => {
    if (!accountId) return toast.error("Choose an account");
    setBusy("send");
    try {
      const res = await ledgerProvider.jointRequest(accountId, email.trim());
      toast.success(res.message);
      setEmail("");
      await load();
    } catch (e) {
      toast.error(friendlyProviderMessage(e));
    } finally { setBusy(null); }
  };

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    try {
      await ledgerProvider.jointRespond(id, accept);
      toast.success(accept ? "You're now a joint owner" : "Request declined");
      await load();
    } catch (e) {
      toast.error(friendlyProviderMessage(e));
    } finally { setBusy(null); }
  };

  const cancel = async (id: string) => {
    setBusy(id);
    try {
      await ledgerProvider.jointCancel(id);
      toast.success("Request withdrawn");
      await load();
    } catch (e) { toast.error(friendlyProviderMessage(e)); }
    finally { setBusy(null); }
  };

  const remove = async () => {
    if (!leaving) return;
    setBusy("remove");
    try {
      const res = await ledgerProvider.jointRemove(leaving.accountId, leaving.userId);
      toast.success(
        res.providerRemoved
          ? "Joint access removed"
          : "Access removed in Glass Bank — we've flagged the bank record for review",
      );
      setLeaving(null);
      await load();
    } catch (e) { toast.error(friendlyProviderMessage(e)); }
    finally { setBusy(null); }
  };

  const primaryAccounts = data?.accounts.filter((a) => a.myRole === "primary") ?? [];

  return (
    <AppLayout>
      <Seo
        title="Joint accounts | Glass Bank"
        description="Add a verified co-owner to a Glass Bank account. Both owners see the balance, transactions, and can move money."
        path="/joint-accounts"
        noindex
      />
      <div className="px-5 pt-14 pb-28 space-y-5 max-w-2xl mx-auto">
        <header className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="w-10 h-10 rounded-full bg-card/60 border border-border/60 grid place-items-center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Joint accounts</h1>
            <p className="text-sm text-muted-foreground">Share an account with another verified customer</p>
          </div>
        </header>

        {!data && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}

        {data && (
          <>
            {/* Requests waiting on ME — acceptance is the only way in. */}
            {data.incoming.length > 0 && (
              <GlassCard className="p-5 space-y-4 border-primary/40">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <h2 className="font-medium">Waiting for your approval</h2>
                </div>
                {data.incoming.map((r) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between gap-3 rounded-xl bg-card/50 border border-border/60 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.from} invited you</p>
                      <p className="text-xs text-muted-foreground">
                        Accepting gives you full access to this account, including moving money.
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => respond(r.id, true)}
                        disabled={busy === r.id}
                        className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Accept
                      </button>
                      <button
                        onClick={() => respond(r.id, false)}
                        disabled={busy === r.id}
                        aria-label="Decline request"
                        className="h-9 w-9 rounded-lg border border-border/60 grid place-items-center disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </GlassCard>
            )}

            {/* Invite */}
            <GlassCard className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <h2 className="font-medium">Add a joint owner</h2>
              </div>
              {primaryAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You need an account you own outright before you can invite a co-owner.
                </p>
              ) : (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-xs text-muted-foreground">Account</span>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="w-full h-11 rounded-xl bg-card/60 border border-border/60 px-3 text-sm"
                    >
                      {primaryAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs text-muted-foreground">Their Glass Bank email (exact match)</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full h-11 rounded-xl bg-card/60 border border-border/60 px-3 text-sm"
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    They must already be a Glass Bank customer with a verified identity. We never confirm whether an
                    email is registered — they'll simply see the request in their app if it is.
                  </p>
                  <button
                    onClick={sendRequest}
                    disabled={busy === "send" || !email.trim()}
                    className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {busy === "send" && <Loader2 className="w-4 h-4 animate-spin" />}
                    Send request
                  </button>
                </>
              )}
            </GlassCard>

            {/* Pending outgoing */}
            {data.outgoing.filter((r) => r.status === "pending").length > 0 && (
              <GlassCard className="p-5 space-y-3">
                <h2 className="font-medium">Requests you've sent</h2>
                {data.outgoing.filter((r) => r.status === "pending").map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{r.to} · {r.accountName}</span>
                    <button
                      onClick={() => cancel(r.id)}
                      disabled={busy === r.id}
                      className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
                    >
                      Withdraw
                    </button>
                  </div>
                ))}
              </GlassCard>
            )}

            {/* Owner rosters */}
            <GlassCard className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h2 className="font-medium">Who can access your accounts</h2>
              </div>
              {data.accounts.length === 0 && (
                <EmptyState icon={Users} title="No accounts yet" description="Finish verification to open an account." />
              )}
              {data.accounts.map((a) => (
                <div key={a.id} className="rounded-xl bg-card/50 border border-border/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{a.name}</p>
                    {a.owners.length > 1 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                        Joint
                      </span>
                    )}
                  </div>
                  {a.owners.map((o) => (
                    <div key={o.userId} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {o.name}{o.isMe ? " (you)" : ""} · {o.role === "primary" ? "Primary owner" : "Joint owner"}
                      </span>
                      {o.role === "joint" && (o.isMe || a.myRole === "primary") && (
                        <button
                          onClick={() => setLeaving({ accountId: a.id, userId: o.userId, name: o.isMe ? "yourself" : o.name })}
                          className="text-xs text-destructive inline-flex items-center gap-1"
                        >
                          <LogOut className="w-3 h-3" />
                          {o.isMe ? "Leave" : "Remove"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </GlassCard>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!leaving}
        onOpenChange={(v) => !v && setLeaving(null)}
        title="Remove joint access?"
        description={`This removes ${leaving?.name ?? "this person"} as an owner. They'll immediately lose access to the balance, transactions and transfers.`}
        confirmLabel="Remove"
        destructive
        onConfirm={remove}
      />
    </AppLayout>
  );
};

export default JointAccounts;
