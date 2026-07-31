// Funding UX for the demo environment. Three tabs:
//
//   1. Bank Transfer (Wire / SEPA-in) — shows the account's deposit details
//      (account number, IBAN, holder, reference) so an external bank can push
//      funds in.
//   2. Debit Card — instant card load, credited to the selected account.
//   3. ACH Pull — link an external US bank and pull funds in.
//
// All movements are posted to the local ledger and reflected immediately in
// balances and the activity feed.
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Landmark, CreditCard, Building2, Zap } from "lucide-react";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";

type Tab = "bank" | "card" | "ach";
type AccountKey = "checking" | "savings";

const AddMoneyPanel = ({ onDone }: { onDone: () => void }) => {
  const { accounts } = useBank();
  const [tab, setTab] = useState<Tab>("bank");
  const [target, setTarget] = useState<AccountKey>("checking");

  const acc = accounts[target] ?? accounts.checking;
  const details = acc?.depositDetails;

  if (!acc) {
    return (
      <div>
        <GlassCard>
          <p className="text-sm text-foreground font-semibold mb-1">Loading your accounts…</p>
          <p className="text-xs text-muted-foreground">Funding options appear as soon as your accounts load.</p>
        </GlassCard>
        <button onClick={onDone} className="w-full mt-5 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">
          Close
        </button>
      </div>
    );
  }

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
        {(["checking", "savings"] as AccountKey[]).map((k) =>
          accounts[k] ? (
            <button
              key={k}
              onClick={() => setTarget(k)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                target === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Into {accounts[k]!.name}
            </button>
          ) : null,
        )}
      </div>

      {tab === "bank" && <BankTransferIn details={details} />}
      {tab === "card" && <InstantLoad target={target} accountName={acc.name} onDone={onDone} label="Debit card" method="Debit card load" />}
      {tab === "ach" && <InstantLoad target={target} accountName={acc.name} onDone={onDone} label="External bank" method="ACH pull" />}

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
}: {
  details?: { accountNumber: string; iban: string; holderName: string; currency: string; reference: string };
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
    return <DepositDetailsUnavailable />;
  }


  const currencyIsEur = details.currency.toUpperCase().includes("EUR");
  const rows: Array<{ label: string; value: string; key: string; mono?: boolean }> = [
    { label: "Beneficiary", value: details.holderName || "—", key: "Beneficiary" },
    { label: currencyIsEur ? "IBAN" : "Account number", value: details.iban || details.accountNumber, key: currencyIsEur ? "IBAN" : "Account number", mono: true },
    { label: "Currency", value: details.currency, key: "Currency" },
    { label: "Reference", value: details.reference, key: "Reference", mono: true },
  ];

  return (
    <div className="space-y-3">
      <GlassCard className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground">{r.label}</p>
              <p className={`text-sm text-foreground truncate ${r.mono ? "font-mono" : "font-semibold"}`}>{r.value}</p>
            </div>
            <button
              onClick={() => copy(r.value, r.key)}
              className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0"
              aria-label={`Copy ${r.label}`}
            >
              {copied === r.key ? <Check size={15} className="text-primary" /> : <Copy size={15} />}
            </button>
          </div>
        ))}
      </GlassCard>
      <GlassCard className="bg-secondary/60">
        <p className="text-xs text-foreground font-semibold mb-1">How this works</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Send a wire or SEPA payment from your other bank using these details. Always include the reference so funds
          route to your account. Incoming payments usually settle the same business day.
        </p>
      </GlassCard>
    </div>
  );
};

// ---- 2 & 3. Instant funding ----------------------------------------------

const InstantLoad = ({
  target,
  accountName,
  onDone,
  label,
  method,
}: {
  target: AccountKey;
  accountName: string;
  onDone: () => void;
  label: string;
  method: string;
}) => {
  const { addFunds } = useBank();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 5 || n > 5000) {
      setError("Enter an amount between 5 and 5,000.");
      return;
    }
    setError(null);
    setBusy(true);
    const ok = await addFunds({ to: target, amount: Math.round(n * 100) / 100, source: method });
    setBusy(false);
    if (ok) onDone();
    else setError("We couldn't complete the deposit. Please try again.");
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
          <p className="text-[11px] text-muted-foreground mt-1.5">Min $5 · Max $5,000 per load · No fee.</p>
        </div>

        {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs leading-relaxed">{error}</div>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy ? "Processing…" : (<><Zap size={16} /> Add money from {label}</>)}
        </button>
      </GlassCard>

      <GlassCard className="bg-secondary/60">
        <p className="text-xs text-foreground font-semibold mb-1">How this works</p>
        <ul className="text-[11px] text-muted-foreground leading-relaxed list-disc pl-4 space-y-0.5">
          <li>Funds are credited to {accountName} instantly.</li>
          <li>Your card or bank details are tokenised — we never store the full number.</li>
          <li>You'll see the deposit in Activity right away.</li>
        </ul>
      </GlassCard>
    </div>
  );
};

export default AddMoneyPanel;
