import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
  ArrowRight,
  Building2,
  User,
} from "lucide-react";
import { accounts, recentRecipients } from "@/data/mockData";

const actions = [
  { label: "Transfer", desc: "Between my accounts", icon: ArrowLeftRight, id: "transfer" },
  { label: "Send Money", desc: "To another person", icon: Send, id: "send" },
  { label: "Deposit Check", desc: "Mobile check deposit", icon: Camera, id: "deposit" },
  { label: "Pay Bills", desc: "One-time or recurring", icon: Receipt, id: "bills" },
  { label: "External Transfer", desc: "ACH to/from bank", icon: Building2, id: "external" },
  { label: "Wire Transfer", desc: "Domestic or international", icon: Globe, id: "wire" },
  { label: "Add Money", desc: "Fund your account", icon: Plus, id: "add" },
];

const MoveMoney = () => {
  const navigate = useNavigate();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  return (
    <AppLayout>
      <div className="px-5 pt-14 space-y-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">Move Money</h1>
          <p className="text-sm text-muted-foreground mt-1">Transfer, send, or deposit funds</p>
        </motion.div>

        {/* Recent Recipients */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <h2 className="text-section-title text-sm text-foreground mb-3">Recent Recipients</h2>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
            {recentRecipients.map((r) => (
              <button key={r.id} className="flex flex-col items-center gap-1.5 min-w-[60px]">
                <div className="w-12 h-12 rounded-full gradient-hero flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold text-sm">{r.initial}</span>
                </div>
                <span className="text-xs text-foreground font-medium truncate max-w-[60px]">{r.name}</span>
                <span className="text-[10px] text-muted-foreground">{r.lastSent}</span>
              </button>
            ))}
            <button className="flex flex-col items-center gap-1.5 min-w-[60px]">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Plus size={20} className="text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">New</span>
            </button>
          </div>
        </motion.div>

        {/* Actions List */}
        <div className="space-y-2">
          {actions.map((action, i) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
            >
              <GlassCard
                onClick={() => setSelectedAction(action.id)}
                className="flex items-center justify-between py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <action.icon size={20} className="text-foreground" />
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

        {/* Transfer Modal/Sheet */}
        {selectedAction === "transfer" && (
          <TransferSheet onClose={() => setSelectedAction(null)} />
        )}
        {selectedAction === "send" && (
          <SendMoneySheet onClose={() => setSelectedAction(null)} />
        )}
        {selectedAction === "deposit" && (
          <DepositSheet onClose={() => setSelectedAction(null)} />
        )}
        {selectedAction && !["transfer", "send", "deposit"].includes(selectedAction) && (
          <ComingSoonSheet action={actions.find(a => a.id === selectedAction)!.label} onClose={() => setSelectedAction(null)} />
        )}
      </div>
    </AppLayout>
  );
};

const TransferSheet = ({ onClose }: { onClose: () => void }) => {
  const [fromAccount, setFromAccount] = useState("checking");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "review" | "success">("form");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto safe-bottom"
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />

        {step === "form" && (
          <>
            <h2 className="text-xl font-display font-bold text-foreground mb-5">Transfer Funds</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">From</label>
                <select
                  value={fromAccount}
                  onChange={(e) => setFromAccount(e.target.value)}
                  className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
                >
                  <option value="checking">Everyday Checking — $12,847.63</option>
                  <option value="savings">High Yield Savings — $28,450.00</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">To</label>
                <select className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none">
                  <option>{fromAccount === "checking" ? "High Yield Savings — $28,450.00" : "Everyday Checking — $12,847.63"}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-3 pl-8 rounded-xl bg-secondary text-foreground text-2xl font-bold border-0 outline-none text-balance-display"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Memo (optional)</label>
                <input className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none" placeholder="Add a note" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Cancel</button>
                <button
                  onClick={() => setStep("review")}
                  disabled={!amount}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
                >
                  Review
                </button>
              </div>
            </div>
          </>
        )}

        {step === "review" && (
          <>
            <h2 className="text-xl font-display font-bold text-foreground mb-5">Review Transfer</h2>
            <GlassCard className="space-y-3 mb-5">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-lg font-bold text-foreground">${Number(amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">From</span>
                <span className="text-sm font-medium text-foreground">{fromAccount === "checking" ? "Everyday Checking" : "High Yield Savings"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">To</span>
                <span className="text-sm font-medium text-foreground">{fromAccount === "checking" ? "High Yield Savings" : "Everyday Checking"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Speed</span>
                <span className="text-sm font-medium text-success">Instant</span>
              </div>
            </GlassCard>
            <div className="flex gap-3">
              <button onClick={() => setStep("form")} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Back</button>
              <button onClick={() => setStep("success")} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Confirm Transfer</button>
            </div>
          </>
        )}

        {step === "success" && (
          <div className="text-center py-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
              <div className="w-20 h-20 rounded-full gradient-hero mx-auto flex items-center justify-center mb-4">
                <ArrowLeftRight size={32} className="text-primary-foreground" />
              </div>
            </motion.div>
            <h2 className="text-xl font-display font-bold text-foreground mb-2">Transfer Complete</h2>
            <p className="text-muted-foreground text-sm mb-6">${Number(amount).toFixed(2)} has been transferred successfully.</p>
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Done</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const SendMoneySheet = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState<"form" | "review" | "success">("form");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto safe-bottom"
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
        {step === "form" && (
          <>
            <h2 className="text-xl font-display font-bold text-foreground mb-5">Send Money</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Recipient</label>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Email, phone, or name"
                  className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">$</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full p-3 pl-8 rounded-xl bg-secondary text-foreground text-2xl font-bold border-0 outline-none text-balance-display" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Note</label>
                <input className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none" placeholder="What's this for? 💸" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Cancel</button>
                <button onClick={() => setStep("review")} disabled={!amount || !recipient} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">Review</button>
              </div>
            </div>
          </>
        )}
        {step === "review" && (
          <>
            <h2 className="text-xl font-display font-bold text-foreground mb-5">Review Payment</h2>
            <GlassCard className="space-y-3 mb-5">
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">To</span><span className="text-sm font-medium text-foreground">{recipient}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Amount</span><span className="text-lg font-bold text-foreground">${Number(amount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">From</span><span className="text-sm font-medium text-foreground">Everyday Checking</span></div>
              <div className="flex justify-between"><span className="text-sm text-muted-foreground">Speed</span><span className="text-sm font-medium text-success">Instant</span></div>
            </GlassCard>
            <div className="flex gap-3">
              <button onClick={() => setStep("form")} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Back</button>
              <button onClick={() => setStep("success")} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Send Money</button>
            </div>
          </>
        )}
        {step === "success" && (
          <div className="text-center py-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
              <div className="w-20 h-20 rounded-full gradient-hero mx-auto flex items-center justify-center mb-4">
                <Send size={32} className="text-primary-foreground" />
              </div>
            </motion.div>
            <h2 className="text-xl font-display font-bold text-foreground mb-2">Money Sent!</h2>
            <p className="text-muted-foreground text-sm mb-6">${Number(amount).toFixed(2)} sent to {recipient}</p>
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Done</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const DepositSheet = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState(0);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto safe-bottom">
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
        {step === 0 && (
          <>
            <h2 className="text-xl font-display font-bold text-foreground mb-2">Deposit a Check</h2>
            <p className="text-sm text-muted-foreground mb-5">Endorse your check: write "For mobile deposit only" on the back.</p>
            <GlassCard className="mb-4">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Daily limit</span><span className="font-medium text-foreground">$10,000.00</span></div>
              <div className="flex justify-between text-sm mt-2"><span className="text-muted-foreground">Monthly limit</span><span className="font-medium text-foreground">$25,000.00</span></div>
            </GlassCard>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Deposit to</label>
                <select className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none">
                  <option>Everyday Checking — ****4821</option>
                  <option>High Yield Savings — ****7392</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">$</span>
                  <input type="number" placeholder="0.00" className="w-full p-3 pl-8 rounded-xl bg-secondary text-foreground text-2xl font-bold border-0 outline-none text-balance-display" />
                </div>
              </div>
            </div>
            <button onClick={() => setStep(1)} className="w-full mt-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Capture Front of Check</button>
            <button onClick={onClose} className="w-full mt-2 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Cancel</button>
          </>
        )}
        {step === 1 && (
          <div className="text-center py-6">
            <div className="w-full h-48 rounded-2xl bg-secondary border-2 border-dashed border-border flex items-center justify-center mb-4">
              <div className="text-center">
                <Camera size={40} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Front of check</p>
                <p className="text-xs text-muted-foreground">Tap to capture</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold">Back</button>
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Use Photo</button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="text-center py-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
              <div className="w-20 h-20 rounded-full gradient-savings mx-auto flex items-center justify-center mb-4">
                <Camera size={32} className="text-primary-foreground" />
              </div>
            </motion.div>
            <h2 className="text-xl font-display font-bold text-foreground mb-2">Deposit Submitted</h2>
            <p className="text-muted-foreground text-sm mb-1">Reference: #DEP-2024-08421</p>
            <p className="text-muted-foreground text-sm mb-6">Funds available by next business day</p>
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Done</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const ComingSoonSheet = ({ action, onClose }: { action: string; onClose: () => void }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose}>
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-5 safe-bottom"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto flex items-center justify-center mb-4">
          <Receipt size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-xl font-display font-bold text-foreground mb-2">{action}</h2>
        <p className="text-sm text-muted-foreground mb-6">This feature is coming soon. We're working on making this available for you.</p>
        <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Got It</button>
      </div>
    </motion.div>
  </motion.div>
);

export default MoveMoney;
