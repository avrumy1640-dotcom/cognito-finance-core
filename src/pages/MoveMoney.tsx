import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import {
  ArrowLeftRight,
  Send,
  Receipt,
  Plus,
  Globe,
  ChevronRight,
  Building2,
  CheckCircle2,
  QrCode,
  CalendarClock,
  Target,
} from "lucide-react";
import AddMoneyPanel from "@/components/money/AddMoneyPanel";
import { useBank } from "@/store/bankStore";
import { useKyc } from "@/hooks/useKyc";
import RequireKyc from "@/components/RequireKyc";
import { FeesTimingCard, LimitsCheckPanel } from "@/components/money/FeesTimingCard";
import { checkLimits } from "@/lib/txPolicy";

// Primary tiles kept intentionally small (Chime/Revolut pattern). Send is now
// a hub screen with a method selector (P2P, ACH, Wire). Advanced actions
// (Scheduled, Bill Pay, Beneficiaries) live behind the More sheet so the
// first-time user isn't overwhelmed.
const primaryActions = [
  { label: "Send", desc: "Person, bank, or wire", icon: Send, id: "send" },
  { label: "Add Money", desc: "Wire, SEPA, or debit card", icon: Plus, id: "add" },
  { label: "Request", desc: "Ask someone to pay you", icon: QrCode, id: "receive" },
  { label: "More", desc: "Scheduled, bills, beneficiaries", icon: ChevronRight, id: "more" },
];

const sendMethods = [
  { label: "Between my accounts", desc: "Instant · Free", icon: ArrowLeftRight, id: "transfer" },
  { label: "To another person", desc: "By email or phone · Instant", icon: Send, id: "send" },
  { label: "Bank transfer (ACH)", desc: "1–3 business days · Free", icon: Building2, id: "external" },
  { label: "Wire transfer", desc: "Same-day domestic · $25 fee", icon: Globe, id: "wire" },
];

const moreActions = [
  { label: "Scheduled Transfers", desc: "Automate future payments", icon: CalendarClock, path: "/scheduled" },
  { label: "Pay Bills", desc: "One-time or recurring · 1–2 days", icon: Receipt, path: null, id: "bills" as const },
  { label: "Beneficiaries", desc: "Manage saved recipients", icon: Building2, path: "/beneficiaries" },
  { label: "Payment Requests", desc: "Track incoming requests", icon: QrCode, path: "/payment-requests" },
  { label: "Direct Deposit", desc: "Get your pay sent here", icon: Building2, path: "/direct-deposit" },
  { label: "Savings Goals", desc: "Save for what's next", icon: Target, path: "/goals" },
];

const MoveMoney = () => {
  const navigate = useNavigate();
  const { action: routeAction } = useParams();
  const { canMoveMoney } = useKyc();
  const initial = routeAction && ["transfer", "send", "external", "wire", "add", "bills"].includes(routeAction) ? routeAction : null;
  const [selected, setSelected] = useState<string | null>(initial);
  const [sendPickerOpen, setSendPickerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  if (!canMoveMoney) {
    return (
      <AppLayout>
        <RequireKyc reason="Verify your identity before moving money in or out of your accounts." />
      </AppLayout>
    );
  }

  const handlePrimary = (id: string) => {
    if (id === "receive") { navigate("/receive"); return; }
    if (id === "more") { setMoreOpen(true); return; }
    if (id === "send") { setSendPickerOpen(true); return; }
    if (id === "add") { setSelected("add"); return; }
  };

  return (
    <AppLayout>
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">Move Money</h1>
          <p className="text-sm text-muted-foreground mt-1">Transfer, send, or deposit funds</p>
        </motion.div>


        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {primaryActions.map((action, i) => (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.04 }}
              onClick={() => handlePrimary(action.id)}
              className="text-left"
            >
              <GlassCard className="flex flex-col gap-3 py-4 h-full">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <action.icon size={22} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{action.desc}</p>
                </div>
              </GlassCard>
            </motion.button>
          ))}
        </div>

        {/* Send method picker */}
        <AnimatePresence>
          {sendPickerOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
              onClick={() => setSendPickerOpen(false)}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                className="w-full max-w-md bg-card rounded-3xl border border-border p-5 space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <h3 className="text-lg font-display font-bold text-foreground">How do you want to send?</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Pick the method that fits your recipient.</p>
                </div>
                {sendMethods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setSendPickerOpen(false); setSelected(m.id); }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-secondary/60 active:bg-secondary transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <m.icon size={20} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* More sheet */}
        <AnimatePresence>
          {moreOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
              onClick={() => setMoreOpen(false)}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                className="w-full max-w-md bg-card rounded-3xl border border-border p-5 space-y-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <h3 className="text-lg font-display font-bold text-foreground">More options</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Advanced tools for power users.</p>
                </div>
                {moreActions.map((m) => (
                  <button
                    key={m.label}
                    onClick={() => {
                      setMoreOpen(false);
                      if (m.path) navigate(m.path);
                      else if ("id" in m && m.id) setSelected(m.id);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-secondary/60 active:bg-secondary transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <m.icon size={20} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>



        <AnimatePresence>
          {selected === "transfer" && <TransferSheet onClose={() => setSelected(null)} />}
          {selected === "send" && <SendMoneySheet onClose={() => setSelected(null)} />}
          {selected === "bills" && <BillPaySheet onClose={() => setSelected(null)} />}
          {selected === "external" && <ExternalTransferSheet onClose={() => setSelected(null)} />}
          {selected === "wire" && <WireSheet onClose={() => setSelected(null)} />}
          {selected === "add" && (
            <Sheet onClose={() => setSelected(null)}>
              <AddMoneyPanel onDone={() => setSelected(null)} />
            </Sheet>
          )}
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
  const { accounts, transfer, spendable } = useBank();
  const [from, setFrom] = useState<"checking" | "savings">("checking");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<"form" | "review" | "success">("form");
  const to = from === "checking" ? "savings" : "checking";
  const fromAcc = accounts[from];
  const numAmount = Number(amount);
  const insufficient = numAmount > 0 && numAmount > spendable(from);

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
  const { accounts, send, spendable } = useBank();
  const [step, setStep] = useState<"form" | "review" | "success">("form");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const numAmount = Number(amount);
  const insufficient = numAmount > spendable("checking");

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

// Mobile check deposit and the old "AddMoneySheet" stub have been removed —
// mobile deposit is handled in-app, and Add Money is now handled
// by the real AddMoneyPanel component (Bank Transfer / Debit Card / ACH).



const BillPaySheet = ({ onClose }: { onClose: () => void }) => {
  const { payBill, accounts, spendable } = useBank();
  const [biller, setBiller] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "success">("form");
  const num = Number(amount);
  const insufficient = num > spendable("checking");

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
  const { externalTransfer, accounts, spendable } = useBank();
  const num = Number(amount);

  const submit = () => {
    if (num <= 0) { toast.error("Enter an amount"); return; }
    if (num > spendable("checking")) { toast.error("Insufficient funds"); return; }
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
  // Beneficiary address — required for the sanctions screening every wire goes
  // through, so it is collected up front rather than failing at submit.
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const { wireTransfer, accounts, spendable } = useBank();
  const num = Number(amount);
  const fee = 25;
  const addressComplete = !!(line1.trim() && city.trim() && region.trim() && postal.trim());

  const submit = () => {
    if (num <= 0) return toast.error("Enter amount");
    if (num + fee > spendable("checking")) return toast.error("Insufficient funds (includes $25 fee)");
    if (routing.replace(/\D/g, "").length !== 9) return toast.error("Routing number must be 9 digits");
    if (!addressComplete) return toast.error("Beneficiary address is required for wires");
    const ok = wireTransfer({
      from: "checking", amount: num, beneficiaryName: name, routingNumber: routing,
      accountNumber: account, memo, fee,
      beneficiaryLine1: line1, beneficiaryCity: city,
      beneficiaryState: region, beneficiaryPostalCode: postal, beneficiaryCountry: "US",
    });
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
            <div className="rounded-xl bg-secondary/50 p-3 space-y-3">
              <p className="text-[11px] text-muted-foreground">
                Beneficiary address — required by the receiving bank for sanctions screening.
              </p>
              <Field label="Street address" value={line1} onChange={setLine1} placeholder="123 Main St" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" value={city} onChange={setCity} placeholder="San Francisco" />
                <Field label="State" value={region} onChange={(v) => setRegion(v.toUpperCase().slice(0, 2))} placeholder="CA" />
              </div>
              <Field label="ZIP code" value={postal} onChange={setPostal} placeholder="94105" />
            </div>

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
              <button onClick={submit} disabled={!num || !name || !routing || !account || !addressComplete || !checkLimits("wire", num).ok} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">Send Wire</button>
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


const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <div>
    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">{label}</label>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none" />
  </div>
);

export default MoveMoney;
