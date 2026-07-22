import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import {
  ArrowLeftRight,
  Send,
  Camera,
  Receipt,
  Plus,
  Globe,
  ChevronRight,
  Building2,
  CheckCircle2,
  QrCode,
  CalendarClock,
} from "lucide-react";
import { useBank } from "@/store/bankStore";
import { useKyc } from "@/hooks/useKyc";
import RequireKyc from "@/components/RequireKyc";
import { FeesTimingCard, LimitsCheckPanel } from "@/components/money/FeesTimingCard";
import { checkLimits } from "@/lib/txPolicy";

const actions = [
  { label: "Transfer", desc: "Between my accounts · Instant · Free", icon: ArrowLeftRight, id: "transfer" },
  { label: "Send Money", desc: "To another person · Instant · Free", icon: Send, id: "send" },
  { label: "Receive Money", desc: "Share account or QR", icon: QrCode, id: "receive" },
  { label: "Scheduled Transfers", desc: "Automate future payments", icon: CalendarClock, id: "scheduled" },
  { label: "Deposit Check", desc: "Mobile check · Next business day", icon: Camera, id: "deposit" },
  { label: "Pay Bills", desc: "One-time or recurring · 1–2 days", icon: Receipt, id: "bills" },
  { label: "External Transfer", desc: "ACH to/from bank · 1–3 days · Free", icon: Building2, id: "external" },
  { label: "Wire Transfer", desc: "Same-day domestic · $25 fee", icon: Globe, id: "wire" },
  { label: "Add Money", desc: "Fund your account", icon: Plus, id: "add" },
];

const MoveMoney = () => {
  const navigate = useNavigate();
  const { action: routeAction } = useParams();
  const { recipients } = useBank();
  const { canMoveMoney } = useKyc();
  const [selected, setSelected] = useState<string | null>(
    routeAction && actions.some((a) => a.id === routeAction) ? routeAction : null
  );

  if (!canMoveMoney) {
    return (
      <AppLayout>
        <RequireKyc reason="Verify your identity before moving money in or out of your accounts." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-5 pt-14 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">Move Money</h1>
          <p className="text-sm text-muted-foreground mt-1">Transfer, send, or deposit funds</p>
        </motion.div>

        <div>
          <h2 className="text-section-title mb-3">Recent Recipients</h2>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
            {recipients.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected("send")}
                className="flex flex-col items-center gap-1.5 min-w-[60px]"
              >
                <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold text-sm">{r.initial}</span>
                </div>
                <span className="text-xs text-foreground font-medium truncate max-w-[60px]">{r.name}</span>
                <span className="text-[10px] text-muted-foreground">{r.lastSent}</span>
              </button>
            ))}
            <button
              onClick={() => setSelected("send")}
              className="flex flex-col items-center gap-1.5 min-w-[60px]"
            >
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Plus size={20} className="text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">New</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {actions.map((action, i) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.04 }}
            >
              <GlassCard
                onClick={() => {
                  if (action.id === "receive") navigate("/receive");
                  else if (action.id === "scheduled") navigate("/scheduled");
                  else setSelected(action.id);
                }}
                className="flex items-center justify-between py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <action.icon size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </GlassCard>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {selected === "transfer" && <TransferSheet onClose={() => setSelected(null)} />}
          {selected === "send" && <SendMoneySheet onClose={() => setSelected(null)} />}
          {selected === "deposit" && <DepositSheet onClose={() => setSelected(null)} />}
          {selected === "bills" && <BillPaySheet onClose={() => setSelected(null)} />}
          {selected === "external" && <ExternalTransferSheet onClose={() => setSelected(null)} />}
          {selected === "wire" && <WireSheet onClose={() => setSelected(null)} />}
          {selected === "add" && <AddMoneySheet onClose={() => setSelected(null)} onPick={(id) => setSelected(id)} />}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
};

const Sheet = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onClose}
    className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm"
  >
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 320 }}
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto safe-bottom"
    >
      <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
      {children}
    </motion.div>
  </motion.div>
);

const SuccessView = ({ title, subtitle, onDone }: { title: string; subtitle: string; onDone: () => void }) => (
  <div className="text-center py-8">
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
      <div className="w-20 h-20 rounded-full gradient-hero mx-auto flex items-center justify-center mb-4">
        <CheckCircle2 size={36} className="text-primary-foreground" />
      </div>
    </motion.div>
    <h2 className="text-xl font-display font-bold text-foreground mb-2">{title}</h2>
    <p className="text-muted-foreground text-sm mb-6">{subtitle}</p>
    <button onClick={onDone} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
      Done
    </button>
  </div>
);

const TransferSheet = ({ onClose }: { onClose: () => void }) => {
  const { accounts, transfer } = useBank();
  const [from, setFrom] = useState<"checking" | "savings">("checking");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<"form" | "review" | "success">("form");
  const to = from === "checking" ? "savings" : "checking";
  const fromAcc = accounts[from];
  const numAmount = Number(amount);
  const insufficient = numAmount > 0 && numAmount > fromAcc.availableBalance;

  const handleConfirm = () => {
    const ok = transfer({ from, to, amount: numAmount, memo });
    if (!ok) {
      toast.error("Transfer failed", { description: "Please check the amount and balance." });
      return;
    }
    toast.success(`Transferred $${numAmount.toFixed(2)}`, {
      description: `To ${to === "checking" ? "Everyday Checking" : "High Yield Savings"}`,
    });
    setStep("success");
  };

  return (
    <Sheet onClose={onClose}>
      {step === "form" && (
        <>
          <h2 className="text-xl font-display font-bold text-foreground mb-5">Transfer Funds</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">From</label>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value as "checking" | "savings")}
                className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
              >
                <option value="checking">Everyday Checking — ${accounts.checking.availableBalance.toLocaleString()}</option>
                <option value="savings">High Yield Savings — ${accounts.savings.availableBalance.toLocaleString()}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">To</label>
              <div className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm">
                {to === "checking" ? "Everyday Checking" : "High Yield Savings"} — ${accounts[to].availableBalance.toLocaleString()}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 pl-8 rounded-xl bg-secondary text-foreground text-2xl font-bold border-0 outline-none text-balance-display"
                />
              </div>
              {insufficient && <p className="text-xs text-destructive mt-1">Insufficient funds</p>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Memo (optional)</label>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
                placeholder="Add a note"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Cancel</button>
              <button
                onClick={() => setStep("review")}
                disabled={!numAmount || insufficient}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
              >
                Review
              </button>
            </div>
          </div>
        </>
      )}

      {step === "review" && (() => {
        const limitCheck = checkLimits("internal", numAmount);
        return (
          <>
            <h2 className="text-xl font-display font-bold text-foreground mb-5">Review Transfer</h2>
            <GlassCard className="space-y-3 mb-3">
              <Row label="Amount" value={`$${numAmount.toFixed(2)}`} bold />
              <Row label="From" value={from === "checking" ? "Everyday Checking" : "High Yield Savings"} />
              <Row label="To" value={to === "checking" ? "Everyday Checking" : "High Yield Savings"} />
              {memo && <Row label="Memo" value={memo} />}
            </GlassCard>
            <div className="space-y-3 mb-5">
              <FeesTimingCard kind="internal" amount={numAmount} />
              <LimitsCheckPanel check={limitCheck} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("form")} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Back</button>
              <button onClick={handleConfirm} disabled={!limitCheck.ok} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">Confirm</button>
            </div>
          </>
        );
      })()}

      {step === "success" && (
        <SuccessView title="Transfer Complete" subtitle={`$${numAmount.toFixed(2)} moved successfully.`} onDone={onClose} />
      )}
    </Sheet>
  );
};

const Row = ({ label, value, bold, success }: { label: string; value: string; bold?: boolean; success?: boolean }) => (
  <div className="flex justify-between">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span
      className={`text-sm font-medium ${bold ? "text-lg font-bold text-foreground" : success ? "text-success" : "text-foreground"}`}
    >
      {value}
    </span>
  </div>
);

const SendMoneySheet = ({ onClose }: { onClose: () => void }) => {
  const { accounts, send } = useBank();
  const [step, setStep] = useState<"form" | "review" | "success">("form");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const numAmount = Number(amount);
  const insufficient = numAmount > accounts.checking.availableBalance;

  const confirm = () => {
    const ok = send({ from: "checking", amount: numAmount, recipient, note });
    if (!ok) {
      toast.error("Payment failed", { description: "Check recipient and amount." });
      return;
    }
    toast.success(`Sent $${numAmount.toFixed(2)}`, { description: `to ${recipient}` });
    setStep("success");
  };

  return (
    <Sheet onClose={onClose}>
      {step === "form" && (
        <>
          <h2 className="text-xl font-display font-bold text-foreground mb-5">Send Money</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Recipient</label>
              <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Email, phone, or name" className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">$</span>
                <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full p-3 pl-8 rounded-xl bg-secondary text-foreground text-2xl font-bold border-0 outline-none text-balance-display" />
              </div>
              {insufficient && numAmount > 0 && <p className="text-xs text-destructive mt-1">Insufficient funds</p>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Note</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none" placeholder="What's this for? 💸" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Cancel</button>
              <button onClick={() => setStep("review")} disabled={!numAmount || !recipient.trim() || insufficient} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">Review</button>
            </div>
          </div>
        </>
      )}
      {step === "review" && (() => {
        const limitCheck = checkLimits("send", numAmount);
        return (
          <>
            <h2 className="text-xl font-display font-bold text-foreground mb-5">Review Payment</h2>
            <GlassCard className="space-y-3 mb-3">
              <Row label="To" value={recipient} />
              <Row label="Amount" value={`$${numAmount.toFixed(2)}`} bold />
              <Row label="From" value="Everyday Checking" />
              {note && <Row label="Note" value={note} />}
            </GlassCard>
            <div className="space-y-3 mb-5">
              <FeesTimingCard kind="send" amount={numAmount} />
              <LimitsCheckPanel check={limitCheck} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("form")} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Back</button>
              <button onClick={confirm} disabled={!limitCheck.ok} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">Send</button>
            </div>
          </>
        );
      })()}
      {step === "success" && (
        <SuccessView title="Money Sent" subtitle={`$${numAmount.toFixed(2)} sent to ${recipient}`} onDone={onClose} />
      )}
    </Sheet>
  );
};

const DepositSheet = ({ onClose }: { onClose: () => void }) => {
  const { depositCheck } = useBank();
  const [step, setStep] = useState(0);
  const [to, setTo] = useState<"checking" | "savings">("checking");
  const [amount, setAmount] = useState("");
  const num = Number(amount);

  const submit = () => {
    const ok = depositCheck({ to, amount: num });
    if (!ok) {
      toast.error("Deposit failed");
      return;
    }
    toast.success("Check submitted", { description: `$${num.toFixed(2)} pending — available next business day` });
    setStep(3);
  };

  return (
    <Sheet onClose={onClose}>
      {step === 0 && (
        <>
          <h2 className="text-xl font-display font-bold text-foreground mb-2">Deposit a Check</h2>
          <p className="text-sm text-muted-foreground mb-5">Endorse with "For mobile deposit only".</p>
          <GlassCard className="mb-4">
            <Row label="Daily limit" value="$10,000.00" />
            <div className="h-2" />
            <Row label="Monthly limit" value="$25,000.00" />
          </GlassCard>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Deposit to</label>
              <select value={to} onChange={(e) => setTo(e.target.value as "checking" | "savings")} className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none">
                <option value="checking">Everyday Checking — ****4821</option>
                <option value="savings">High Yield Savings — ****7392</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">$</span>
                <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full p-3 pl-8 rounded-xl bg-secondary text-foreground text-2xl font-bold border-0 outline-none text-balance-display" />
              </div>
            </div>
          </div>
          <button disabled={!num} onClick={() => setStep(1)} className="w-full mt-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">Capture Front of Check</button>
          <button onClick={onClose} className="w-full mt-2 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Cancel</button>
        </>
      )}
      {step === 1 && (
        <CaptureStep label="Front of check" onNext={() => setStep(2)} onBack={() => setStep(0)} nextLabel="Capture Back" />
      )}
      {step === 2 && (
        <CaptureStep label="Back of check" onNext={submit} onBack={() => setStep(1)} nextLabel="Submit Deposit" />
      )}
      {step === 3 && (
        <SuccessView
          title="Deposit Submitted"
          subtitle={`$${num.toFixed(2)} pending — available by next business day`}
          onDone={onClose}
        />
      )}
    </Sheet>
  );
};

const CaptureStep = ({ label, onNext, onBack, nextLabel }: { label: string; onNext: () => void; onBack: () => void; nextLabel: string }) => (
  <div className="text-center py-4">
    <div className="w-full h-48 rounded-2xl bg-secondary border-2 border-dashed border-border flex items-center justify-center mb-4">
      <div className="text-center">
        <Camera size={40} className="text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">Tap to capture</p>
      </div>
    </div>
    <div className="flex gap-3">
      <button onClick={onBack} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Back</button>
      <button onClick={onNext} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">{nextLabel}</button>
    </div>
  </div>
);

const BillPaySheet = ({ onClose }: { onClose: () => void }) => {
  const { payBill, accounts } = useBank();
  const [biller, setBiller] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "success">("form");
  const num = Number(amount);
  const insufficient = num > accounts.checking.availableBalance;

  const pay = () => {
    const ok = payBill({ from: "checking", amount: num, biller });
    if (!ok) {
      toast.error("Payment failed");
      return;
    }
    toast.success(`Paid $${num.toFixed(2)}`, { description: `to ${biller}` });
    setStep("success");
  };

  const suggested = ["PG&E Utilities", "Comcast Xfinity", "Verizon Wireless", "State Farm Insurance", "Rent"];

  return (
    <Sheet onClose={onClose}>
      {step === "form" && (
        <>
          <h2 className="text-xl font-display font-bold text-foreground mb-5">Pay a Bill</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Biller</label>
              <input value={biller} onChange={(e) => setBiller(e.target.value)} placeholder="Search or type biller name" className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none" />
              <div className="flex gap-2 mt-2 flex-wrap">
                {suggested.map((b) => (
                  <button key={b} onClick={() => setBiller(b)} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground hover:text-foreground">
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">$</span>
                <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full p-3 pl-8 rounded-xl bg-secondary text-foreground text-2xl font-bold border-0 outline-none text-balance-display" />
              </div>
              {insufficient && num > 0 && <p className="text-xs text-destructive mt-1">Insufficient funds</p>}
            </div>
            <FeesTimingCard kind="bill" amount={num} />
            <LimitsCheckPanel check={checkLimits("bill", num)} />
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Cancel</button>
              <button onClick={pay} disabled={!num || !biller.trim() || insufficient || !checkLimits("bill", num).ok} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">Pay Now</button>
            </div>
          </div>
        </>
      )}
      {step === "success" && (
        <SuccessView title="Bill Paid" subtitle={`$${num.toFixed(2)} sent to ${biller}`} onDone={onClose} />
      )}
    </Sheet>
  );
};

const ExternalTransferSheet = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState<"form" | "success">("form");
  const [bank, setBank] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const { externalTransfer, accounts } = useBank();
  const num = Number(amount);

  const submit = () => {
    if (num <= 0) { toast.error("Enter an amount"); return; }
    if (num > accounts.checking.availableBalance) { toast.error("Insufficient funds"); return; }
    if (routing.replace(/\D/g, "").length !== 9) { toast.error("Routing number must be 9 digits"); return; }
    const ok = externalTransfer({ from: "checking", amount: num, bank, routingNumber: routing, accountNumber: account, memo });
    if (!ok) { toast.error("Transfer failed"); return; }
    toast.success("External transfer initiated", { description: `$${num.toFixed(2)} — 1–3 business days` });
    setStep("success");
  };

  return (
    <Sheet onClose={onClose}>
      {step === "form" && (
        <>
          <h2 className="text-xl font-display font-bold text-foreground mb-2">External Transfer</h2>
          <p className="text-sm text-muted-foreground mb-5">ACH — arrives in 1–3 business days.</p>
          <div className="space-y-3">
            <Field label="Bank name" value={bank} onChange={setBank} placeholder="Chase, Bank of America…" />
            <Field label="Routing number" value={routing} onChange={setRouting} placeholder="9 digits" />
            <Field label="Account number" value={account} onChange={setAccount} placeholder="Account #" />
            <Field label="Memo (optional)" value={memo} onChange={setMemo} placeholder="What's this for?" />
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">$</span>
                <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full p-3 pl-8 rounded-xl bg-secondary text-foreground text-2xl font-bold border-0 outline-none text-balance-display" />
              </div>
            </div>
            <FeesTimingCard kind="external" amount={num} />
            <LimitsCheckPanel check={checkLimits("external", num)} />
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Cancel</button>
              <button
                onClick={submit}
                disabled={!num || !bank || !routing || !account || !checkLimits("external", num).ok}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
              >
                Send Transfer
              </button>
            </div>
          </div>
        </>
      )}
      {step === "success" && (
        <SuccessView title="Transfer Initiated" subtitle={`$${num.toFixed(2)} sent to ${bank}. Arrives in 1–3 business days.`} onDone={onClose} />
      )}
    </Sheet>
  );
};

const WireSheet = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState<"form" | "success">("form");
  const [name, setName] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const { wireTransfer, accounts } = useBank();
  const num = Number(amount);
  const fee = 25;

  const submit = () => {
    if (num <= 0) return toast.error("Enter amount");
    if (num + fee > accounts.checking.availableBalance) return toast.error("Insufficient funds (includes $25 fee)");
    if (routing.replace(/\D/g, "").length !== 9) return toast.error("Routing number must be 9 digits");
    const ok = wireTransfer({ from: "checking", amount: num, beneficiaryName: name, routingNumber: routing, accountNumber: account, memo, fee });
    if (!ok) return toast.error("Wire failed");
    toast.success("Wire initiated", { description: `$${num.toFixed(2)} + $${fee} fee` });
    setStep("success");
  };

  return (
    <Sheet onClose={onClose}>
      {step === "form" && (
        <>
          <h2 className="text-xl font-display font-bold text-foreground mb-2">Wire Transfer</h2>
          <p className="text-sm text-muted-foreground mb-5">Same-day if sent before 4:00 PM ET. $25 fee.</p>
          <div className="space-y-3">
            <Field label="Beneficiary name" value={name} onChange={setName} placeholder="Full legal name" />
            <Field label="Routing number" value={routing} onChange={setRouting} placeholder="9 digits" />
            <Field label="Beneficiary account" value={account} onChange={setAccount} placeholder="Account #" />
            <Field label="Memo (optional)" value={memo} onChange={setMemo} placeholder="Wire reference" />
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">$</span>
                <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full p-3 pl-8 rounded-xl bg-secondary text-foreground text-2xl font-bold border-0 outline-none text-balance-display" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">+ $25.00 wire fee</p>
            </div>
            <FeesTimingCard kind="wire" amount={num} />
            <LimitsCheckPanel check={checkLimits("wire", num)} />
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Cancel</button>
              <button onClick={submit} disabled={!num || !name || !routing || !account || !checkLimits("wire", num).ok} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">Send Wire</button>
            </div>
          </div>
        </>
      )}
      {step === "success" && (
        <SuccessView title="Wire Sent" subtitle={`$${num.toFixed(2)} to ${name}`} onDone={onClose} />
      )}
    </Sheet>
  );
};

const AddMoneySheet = ({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) => (
  <Sheet onClose={onClose}>
    <h2 className="text-xl font-display font-bold text-foreground mb-2">Add Money</h2>
    <p className="text-sm text-muted-foreground mb-5">Fund your Glass Bank account.</p>
    <div className="space-y-2">
      {[
        { id: "direct", label: "Direct Deposit", desc: "Set up recurring paycheck", icon: "💰",
          run: () => toast.success("Direct deposit form", { description: "Routing 121145307 · Account ending in your linked account" }) },
        { id: "external", label: "Link External Bank", desc: "ACH pull from another bank", icon: "🏦",
          run: () => onPick("external") },
        { id: "deposit", label: "Deposit a Check", desc: "Mobile check deposit", icon: "📸",
          run: () => onPick("deposit") },
        { id: "cash", label: "Cash at Retail", desc: "Green Dot locations nationwide", icon: "🧾",
          run: () => toast.success("Barcode ready", { description: "Show at any Green Dot register to deposit up to $500" }) },
      ].map((m) => (
        <GlassCard
          key={m.label}
          onClick={m.run}
          className="flex items-center justify-between py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl w-8 text-center">{m.icon}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.desc}</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </GlassCard>
      ))}
    </div>
    <button onClick={onClose} className="w-full mt-5 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Close</button>
  </Sheet>
);

const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div>
    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">{label}</label>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none" />
  </div>
);

export default MoveMoney;
