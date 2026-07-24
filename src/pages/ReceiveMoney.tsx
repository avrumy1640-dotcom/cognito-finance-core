import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Copy,
  Share2,
  Mail,
  MessageSquare,
  Download,
  Check,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import GlassCard from "@/components/glass/GlassCard";
import { useBank } from "@/store/bankStore";
import { useAuth } from "@/hooks/useAuth";

type AccountKey = "checking" | "savings";

const ReceiveMoney = () => {
  const navigate = useNavigate();
  const { accounts } = useBank();
  const { user } = useAuth();
  const [account, setAccount] = useState<AccountKey>("checking");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const acc = accounts[account];
  // Prefer real Iberbanco deposit details (populated on live sync). Fall back
  // to the local placeholder when the account hasn't been hydrated yet.
  const details = acc.depositDetails;
  const fullAccountNumber = useMemo(() => {
    if (details?.accountNumber) return details.accountNumber;
    const tail = acc.accountNumber.replace(/[^0-9]/g, "");
    return tail.length >= 10 ? tail : `100${tail.padStart(7, "0")}`;
  }, [acc.accountNumber, details]);
  const iban = details?.iban || "";
  const beneficiaryName = details?.holderName || user?.email || "Glass Bank customer";
  const currency = details?.currency || "USD";
  const routeLine = iban || acc.routingNumber;

  const shareText = useMemo(() => {
    const lines = [
      `Send money to ${beneficiaryName} at Glass Bank`,
      iban ? `IBAN: ${iban}` : `Account: ${fullAccountNumber}`,
      iban ? `Currency: ${currency}` : `Routing: ${acc.routingNumber}`,
      `Reference (required): ${details?.reference || fullAccountNumber}`,
    ];
    if (amount) lines.push(`Amount: ${currency} ${Number(amount).toFixed(2)}`);
    if (note) lines.push(`Note: ${note}`);
    return lines.join("\n");
  }, [acc, fullAccountNumber, amount, note, beneficiaryName, iban, currency, details]);

  const qrPayload = useMemo(() => {
    const params = new URLSearchParams({
      account: fullAccountNumber,
      routing: routeLine,
      reference: details?.reference || fullAccountNumber,
    });
    if (amount) params.set("amount", Number(amount).toFixed(2));
    if (note) params.set("note", note);
    if (user?.email) params.set("to", user.email);
    return `glassbank://pay?${params.toString()}`;
  }, [fullAccountNumber, routeLine, amount, note, user, details]);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      toast.error("Copy failed");
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Glass Bank — Receive Money", text: shareText });
        return;
      } catch {
        // fall through to copy
      }
    }
    await copy(shareText, "share");
  };

  const downloadQr = () => {
    const svg = document.getElementById("receive-qr") as unknown as SVGSVGElement | null;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glassbank-receive-${account}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("QR code saved");
  };

  return (
    <AppLayout>
      <div className="px-5 pt-6 pb-8 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-muted-foreground" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Receive Money</h1>
            <p className="text-sm text-muted-foreground">Share your account details or a QR to get paid</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex gap-1 p-1 bg-secondary rounded-xl">
            {(["checking", "savings"] as AccountKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setAccount(k)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  account === k ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {accounts[k].name}
              </button>
            ))}
          </div>
        </motion.div>

        <GlassCard className="flex flex-col items-center gap-3 py-6">
          <div className="p-4 bg-background rounded-2xl border border-border">
            <QRCodeSVG id="receive-qr" value={qrPayload} size={180} level="M" />
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-[240px]">
            Scan with any Glass Bank app to send funds directly to this account.
          </p>
        </GlassCard>

        <GlassCard className="space-y-3">
          <DetailRow
            label="Beneficiary"
            value={beneficiaryName}
          />
          {iban ? (
            <DetailRow
              label="IBAN"
              value={iban}
              onCopy={() => copy(iban, "iban")}
              copied={copied === "iban"}
            />
          ) : (
            <DetailRow
              label="Account number"
              value={fullAccountNumber}
              onCopy={() => copy(fullAccountNumber, "account")}
              copied={copied === "account"}
            />
          )}
          {!iban && (
            <DetailRow
              label="Routing number"
              value={acc.routingNumber}
              onCopy={() => copy(acc.routingNumber, "routing")}
              copied={copied === "routing"}
            />
          )}
          <DetailRow
            label="Currency"
            value={currency}
          />
          <DetailRow
            label="Reference (required)"
            value={details?.reference || fullAccountNumber}
            onCopy={() => copy(details?.reference || fullAccountNumber, "reference")}
            copied={copied === "reference"}
          />
        </GlassCard>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          The sender must include the reference exactly as shown — that's how the deposit gets credited to your account.
        </p>

        <div>
          <h2 className="text-section-title mb-3">Request a specific amount (optional)</h2>
          <GlassCard className="space-y-3">
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
                  className="w-full p-3 pl-8 rounded-xl bg-secondary text-foreground text-lg font-semibold border-0 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Note</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's this for?"
                className="w-full p-3 rounded-xl bg-secondary text-foreground text-sm border-0 outline-none"
              />
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={share}
            className="py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Share2 size={16} /> Share details
          </button>
          <button
            onClick={downloadQr}
            className="py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Download size={16} /> Save QR
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={`mailto:?subject=${encodeURIComponent("Payment details — Glass Bank")}&body=${encodeURIComponent(shareText)}`}
            className="py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Mail size={16} /> Email
          </a>
          <a
            href={`sms:?&body=${encodeURIComponent(shareText)}`}
            className="py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2"
          >
            <MessageSquare size={16} /> Text
          </a>
        </div>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          Only share these details with people you trust to send you money. We never ask for account details to move money out.
        </p>
      </div>
    </AppLayout>
  );
};

const DetailRow = ({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground font-mono">{value}</p>
    </div>
    {onCopy && (
      <button
        onClick={onCopy}
        className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
      </button>
    )}
  </div>
);

export default ReceiveMoney;
