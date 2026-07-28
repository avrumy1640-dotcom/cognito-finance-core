import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { generateDirectDepositForm } from "@/lib/pdfDocuments";
import { ArrowLeft, Copy, Check, Download, Building2, ShieldCheck } from "lucide-react";

/**
 * Direct deposit setup — the routing/account pair an employer needs, plus a
 * one-page authorization form generated from the local ledger.
 */
const BANK_NAME = "Glass Bank, N.A.";

const DirectDeposit = () => {
  const navigate = useNavigate();
  const { accounts, dataStatus } = useBank();
  const [which, setWhich] = useState<"checking" | "savings">("checking");
  const [employer, setEmployer] = useState("");
  const [amountNote, setAmountNote] = useState("Entire net pay");
  const [copied, setCopied] = useState<string | null>(null);

  const account = accounts[which];
  const fullNumber = account?.depositDetails?.accountNumber || "";
  const routing = account?.routingNumber || "";
  const holder = account?.depositDetails?.holderName || "Account holder";

  const copy = async (value: string, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1600);
    } catch {
      toast.error("Copy failed — long-press to copy manually");
    }
  };

  const copyAll = () =>
    copy(
      [
        `Bank: ${BANK_NAME}`,
        `Account holder: ${holder}`,
        `Account type: ${which === "savings" ? "Savings" : "Checking"}`,
        `Routing number: ${routing}`,
        `Account number: ${fullNumber}`,
      ].join("\n"),
      "All details",
    );

  const download = () => {
    if (!fullNumber) {
      toast.error("Account details are still loading");
      return;
    }
    generateDirectDepositForm({
      employerName: employer.trim(),
      employeeName: holder,
      accountName: account.name,
      accountNumber: fullNumber,
      routingNumber: routing,
      accountType: which === "savings" ? "Savings" : "Checking",
      amountNote: amountNote.trim() || "Entire net pay",
    });
    toast.success("Direct deposit form downloaded");
  };

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-semibold text-foreground tabular-nums truncate">{value || "—"}</p>
      </div>
      <button
        onClick={() => copy(value, label)}
        className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-xs font-medium text-foreground active:scale-95 transition-transform"
      >
        {copied === label ? <Check size={14} className="text-success" /> : <Copy size={14} />}
        {copied === label ? "Copied" : "Copy"}
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background">
      <div className="px-5 sm:px-6 lg:px-0 pt-10 sm:pt-12 pb-12 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="h-11 w-11 rounded-full bg-secondary flex items-center justify-center">
            <ArrowLeft size={20} className="text-foreground" />
          </button>
          <div>
            <p className="kicker text-primary">Get paid early</p>
            <h1 className="text-lg font-display font-bold text-foreground leading-tight">Direct deposit</h1>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex gap-2">
            {(["checking", "savings"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setWhich(k)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                  which === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {k === "checking" ? "Checking" : "Savings"}
              </button>
            ))}
          </div>

          <GlassCard elevated className="divide-y divide-border">
            <div className="pb-3">
              <p className="text-xs text-muted-foreground">Deposit into</p>
              <p className="text-sm font-semibold text-foreground">{account?.name}</p>
            </div>
            <Row label="Routing number" value={routing} />
            <Row label="Account number" value={fullNumber} />
            <Row label="Account holder" value={holder} />
            <Row label="Bank name" value={BANK_NAME} />
            <div className="pt-3">
              <button
                onClick={copyAll}
                disabled={!fullNumber}
                className="w-full py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {copied === "All details" ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                {copied === "All details" ? "Details copied" : "Copy details"}
              </button>
            </div>
            <div className="pt-3 flex items-start gap-2">
              <ShieldCheck size={16} className="text-success mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Share these numbers only with your employer or a trusted payer. Deposits usually arrive up to two days early.
              </p>
            </div>
          </GlassCard>

          <GlassCard className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Pre-filled employer form</h2>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Employer name</label>
              <input
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                placeholder="e.g. Norven Health"
                className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Deposit amount</label>
              <input
                value={amountNote}
                onChange={(e) => setAmountNote(e.target.value)}
                placeholder="Entire net pay"
                className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
              />
            </div>
            <button
              onClick={download}
              disabled={dataStatus !== "loaded"}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download size={16} />
              Download PDF form
            </button>
            <p className="text-[11px] text-muted-foreground text-center">
              Hand this signed form to your payroll team, or print it from the downloaded PDF.
            </p>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default DirectDeposit;
