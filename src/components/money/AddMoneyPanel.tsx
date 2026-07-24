// Real funding UX built directly on Iberbanco v2. Replaces the previous
// toast-only "AddMoneySheet". Three tabs:
//
//   1. Bank Transfer (Wire / SEPA-in) — shows the caller's real Iberbanco
//      account details (account_special_number, IBAN, holder, reference) so
//      an external bank can push funds in. Incoming credits land via the
//      iberbanco-webhook → iberbanco-events broadcast → bankStore refresh
//      chain we already have.
//
//   2. Debit Card — attempts Iberbanco's payment-gateway deposit endpoint
//      (`/gateway/deposit`) and opens the hosted checkout URL if the agent
//      has the feature enabled. If Iberbanco returns an error (feature not
//      enabled, unsupported currency, etc.) the error is shown verbatim so
//      the user knows exactly why it failed instead of getting a fake toast.
//
//   3. ACH pull from an external US bank — NOT SUPPORTED by Iberbanco v2's
//      current API surface. We disable the tab with a clear explanation
//      rather than fake a debit flow.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, ExternalLink, ShieldAlert, Landmark, CreditCard, Building2 } from "lucide-react";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { iberbancoApi, fetchMyIberUserNumber } from "@/lib/iberbancoClient";

type Tab = "bank" | "card" | "ach";
type AccountKey = "checking" | "savings";

const AddMoneyPanel = ({ onDone }: { onDone: () => void }) => {
  const { accounts, columnLive } = useBank();
  const [tab, setTab] = useState<Tab>("bank");
  const [target, setTarget] = useState<AccountKey>("checking");

  const acc = accounts[target];
  const details = acc.depositDetails;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-display font-bold text-foreground">Add Money</h2>
        <p className="text-sm text-muted-foreground mt-1">Fund your account from an outside source.</p>
      </div>

      <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-4" role="tablist">
        {[
          { id: "bank" as Tab, label: "Bank Transfer", icon: Landmark },
          { id: "card" as Tab, label: "Debit Card", icon: CreditCard },
          { id: "ach" as Tab, label: "ACH Pull", icon: Building2 },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            role="tab"
            aria-selected={tab === t.id}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-4">
        {(["checking", "savings"] as AccountKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setTarget(k)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
              target === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Into {accounts[k].name}
          </button>
        ))}
      </div>

      {!columnLive && (
        <GlassCard className="mb-4 border-warning/40">
          <div className="flex gap-3">
            <ShieldAlert size={18} className="text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">Live account not linked yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                We can show the funding options, but incoming funds only settle after your Iberbanco account is fully provisioned.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {tab === "bank" && <BankTransferIn details={details} accountName={acc.name} />}
      {tab === "card" && <CardLoad accountNumber={acc.id} accountName={acc.name} currency={details?.currency ?? "USD"} onDone={onDone} />}
      {tab === "ach" && <AchPullUnavailable />}

      <button
        onClick={onDone}
        className="w-full mt-5 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold"
      >
        Close
      </button>
    </div>
  );
};

// ---- 1. Bank Transfer In (Wire / SEPA) -----------------------------------

const BankTransferIn = ({
  details,
  accountName,
}: {
  details?: { accountNumber: string; iban: string; holderName: string; currency: string; reference: string };
  accountName: string;
}) => {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (value: string, key: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success(`${key} copied`);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  if (!details?.accountNumber) {
    return (
      <GlassCard>
        <p className="text-sm text-foreground font-semibold mb-1">Deposit details not available yet</p>
        <p className="text-xs text-muted-foreground">
          Your Iberbanco account is still being provisioned. Come back after verification completes and refresh — deposit details appear automatically.
        </p>
      </GlassCard>
    );
  }

  const currencyIsEur = details.currency.toUpperCase().includes("EUR");
  const rows: Array<{ label: string; value: string; key: string; mono?: boolean; hint?: string }> = [
    { label: "Beneficiary", value: details.holderName || "—", key: "Beneficiary" },
    { label: currencyIsEur ? "IBAN" : "Account number", value: details.iban || details.accountNumber, key: currencyIsEur ? "IBAN" : "Account number", mono: true },
    { label: "Currency", value: details.currency, key: "Currency" },
    { label: "Reference / memo", value: details.reference, key: "Reference", mono: true, hint: "Must be included by the sender so we can route the deposit to you." },
  ];

  return (
    <div className="space-y-3">
      <GlassCard className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{r.label}</p>
              <p className={`text-sm text-foreground font-semibold break-all ${r.mono ? "font-mono" : ""}`}>{r.value}</p>
              {r.hint && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{r.hint}</p>}
            </div>
            <button
              onClick={() => copy(r.value, r.key)}
              className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground shrink-0"
              aria-label={`Copy ${r.label}`}
            >
              {copied === r.key ? <Check size={16} className="text-success" /> : <Copy size={16} />}
            </button>
          </div>
        ))}
      </GlassCard>

      <GlassCard className="bg-secondary/60">
        <p className="text-xs text-foreground font-semibold mb-1">How this works</p>
        <ul className="text-[11px] text-muted-foreground leading-relaxed list-disc pl-4 space-y-0.5">
          <li>Log into the sending bank and initiate {currencyIsEur ? "a SEPA transfer" : "a wire transfer"} to the details above.</li>
          <li>Include the reference exactly as shown — it's how we credit your {accountName}.</li>
          <li>{currencyIsEur ? "SEPA arrives same or next business day." : "Domestic wires typically arrive same business day; international wires 1–3 days."}</li>
          <li>Your balance updates automatically the moment the deposit posts.</li>
        </ul>
      </GlassCard>
    </div>
  );
};

// ---- 2. Debit-card / hosted-payment gateway ------------------------------

const CardLoad = ({
  accountNumber,
  accountName,
  currency,
  onDone,
}: {
  accountNumber: string;
  accountName: string;
  currency: string;
  onDone: () => void;
}) => {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencyId = useMemo(() => {
    const map: Record<string, number> = { USD: 1, EUR: 2, GBP: 3, CHF: 4, CAD: 5, AUD: 6, JPY: 7 };
    return map[currency.toUpperCase()] ?? 1;
  }, [currency]);

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 5 || n > 5000) {
      setError("Enter an amount between 5 and 5,000.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const userNumber = await fetchMyIberUserNumber();
      if (!userNumber) {
        setError("Your Iberbanco account isn't linked yet. Complete verification first.");
        return;
      }
      const res = await iberbancoApi.createGatewayDeposit({
        user_number: userNumber,
        account_number: accountNumber,
        amount: Math.round(n),
        currency: currencyId,
        reference: `Card load to ${accountName}`,
        return_url: `${window.location.origin}/activity`,
      });
      const url = res?.redirect_url || res?.payment_url || res?.url;
      if (!url) {
        setError(
          "Iberbanco accepted the request but didn't return a checkout URL. Card funding may not be enabled on your agent — contact support to activate it.",
        );
        return;
      }
      toast.success("Opening secure checkout…", { description: "Complete the payment on Iberbanco's page. Your balance updates automatically once cleared." });
      window.location.href = url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Show the provider's real error — this is how we honestly signal
      // "feature not enabled on your agent" vs. "KYC blocked" vs. anything
      // else, instead of a generic "something went wrong".
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <GlassCard className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount to load</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">$</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min={5}
              max={5000}
              className="w-full p-3 pl-8 rounded-xl bg-secondary text-foreground text-lg font-semibold border-0 outline-none"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Min $5 · Max $5,000 per load · Provider fees may apply.</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs leading-relaxed">
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? "Preparing checkout…" : (<><ExternalLink size={16} /> Continue to secure checkout</>)}
        </button>
      </GlassCard>

      <GlassCard className="bg-secondary/60">
        <p className="text-xs text-foreground font-semibold mb-1">How this works</p>
        <ul className="text-[11px] text-muted-foreground leading-relaxed list-disc pl-4 space-y-0.5">
          <li>You'll be redirected to Iberbanco's PCI-compliant checkout to enter card details.</li>
          <li>We never see or store your card number.</li>
          <li>Funds land in {accountName} once the card issuer clears the charge (usually seconds, sometimes up to an hour).</li>
        </ul>
      </GlassCard>
    </div>
  );
};

// ---- 3. ACH Pull — unavailable -------------------------------------------

const AchPullUnavailable = () => (
  <div className="space-y-3">
    <GlassCard className="border-warning/40">
      <div className="flex gap-3">
        <ShieldAlert size={18} className="text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Not available yet</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Our banking partner's current API supports outbound ACH (paying out to another bank) but does not yet
            expose an inbound ACH pull to fund your account from an external US checking or savings account.
          </p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            In the meantime, use <span className="font-semibold text-foreground">Bank Transfer</span> (push a wire or
            SEPA from your other bank) or <span className="font-semibold text-foreground">Debit Card</span> to load funds
            instantly.
          </p>
        </div>
      </div>
    </GlassCard>
    <GlassCard className="bg-secondary/60">
      <p className="text-xs text-foreground font-semibold mb-1">Coming when the partner enables it</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Real ACH pull requires micro-deposit verification of the external account before we'll trust
        the routing/account numbers you enter. We'll enable this end-to-end as soon as Iberbanco exposes
        the inbound ACH endpoint.
      </p>
    </GlassCard>
  </div>
);

export default AddMoneyPanel;
