// Real PDF generation for monthly statements and year-end tax documents.
// Uses jsPDF client-side so the app doesn't need a backend PDF service.
import { jsPDF } from "jspdf";
import type { Transaction } from "@/types/transaction";

interface Account {
  name: string;
  accountNumber: string;
  routingNumber: string;
  availableBalance: number;
  currentBalance: number;
  openedDate?: string;
  apy?: number;
  interestEarned?: number;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(15, 42, 68); // slate/navy — matches app palette
  doc.rect(0, 0, 612, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Glass Bank", 40, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(subtitle, 40, 52);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 572, 34, { align: "right" });
  doc.setTextColor(30, 30, 30);
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "Glass Bank, N.A. · Member FDIC · This document is generated electronically.",
      306,
      780,
      { align: "center" }
    );
    doc.text(`Page ${i} of ${pages}`, 572, 780, { align: "right" });
  }
}

function triggerDownload(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export interface StatementOptions {
  account: Account;
  transactions: Transaction[];
  periodLabel: string; // e.g. "March 2026"
  periodStart: Date;
  periodEnd: Date;
}

export function generateMonthlyStatement({
  account,
  transactions,
  periodLabel,
  periodStart,
  periodEnd,
}: StatementOptions) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  header(doc, "Monthly Statement", `${periodLabel} · ${account.name}`);

  // Account summary block
  let y = 100;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Account Summary", 40, y);
  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(40, y, 572, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summary: [string, string][] = [
    ["Account", account.name],
    ["Account Number", account.accountNumber],
    ["Routing Number", account.routingNumber || "—"],
    ["Statement Period", `${periodStart.toLocaleDateString()} – ${periodEnd.toLocaleDateString()}`],
    ["Statement Date", new Date().toLocaleDateString()],
  ];
  summary.forEach(([k, v]) => {
    doc.setTextColor(110, 110, 110);
    doc.text(k, 40, y);
    doc.setTextColor(20, 20, 20);
    doc.text(v, 572, y, { align: "right" });
    y += 16;
  });

  // Balance box
  y += 6;
  const credits = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const debits = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const startBal = Number((account.currentBalance - credits + debits).toFixed(2));

  doc.setFillColor(245, 248, 251);
  doc.rect(40, y, 532, 74, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text("Beginning Balance", 56, y + 20);
  doc.text("Deposits & Credits", 220, y + 20);
  doc.text("Withdrawals & Debits", 384, y + 20);
  doc.text("Ending Balance", 556, y + 20, { align: "right" });
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text(fmt(startBal), 56, y + 46);
  doc.setTextColor(20, 130, 60);
  doc.text(`+${fmt(credits)}`, 220, y + 46);
  doc.setTextColor(180, 40, 40);
  doc.text(`-${fmt(debits)}`, 384, y + 46);
  doc.setTextColor(20, 20, 20);
  doc.text(fmt(account.currentBalance), 556, y + 46, { align: "right" });
  y += 96;

  // Transaction table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text("Transaction History", 40, y);
  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(40, y, 572, y);
  y += 16;

  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text("Date", 40, y);
  doc.text("Description", 130, y);
  doc.text("Type", 400, y);
  doc.text("Amount", 572, y, { align: "right" });
  y += 12;
  doc.setDrawColor(240, 240, 240);
  doc.line(40, y - 4, 572, y - 4);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  if (transactions.length === 0) {
    doc.setTextColor(140, 140, 140);
    doc.text("No transactions posted during this period.", 40, y + 8);
  } else {
    transactions.forEach((t) => {
      if (y > 740) {
        doc.addPage();
        y = 60;
      }
      doc.setTextColor(80, 80, 80);
      doc.text(String(t.date).slice(0, 20), 40, y);
      doc.setTextColor(20, 20, 20);
      doc.text(String(t.merchant).slice(0, 48), 130, y);
      doc.setTextColor(110, 110, 110);
      doc.text(t.paymentMethod || t.category || "—", 400, y);
      doc.setTextColor(t.amount >= 0 ? 20 : 180, t.amount >= 0 ? 130 : 40, t.amount >= 0 ? 60 : 40);
      doc.text(`${t.amount >= 0 ? "+" : ""}${fmt(t.amount)}`, 572, y, { align: "right" });
      y += 16;
    });
  }

  footer(doc);
  const safe = periodLabel.replace(/\s+/g, "_");
  triggerDownload(doc, `GlassBank_${account.name.replace(/\s+/g, "_")}_${safe}.pdf`);
}

export interface TaxFormOptions {
  account: Account;
  year: number;
  interestEarned: number; // Box 1 — interest income
  earlyWithdrawalPenalty?: number; // Box 2
  federalTaxWithheld?: number; // Box 4
  recipientName: string;
  recipientAddress?: string;
  recipientTin?: string; // masked
}

export function generate1099INT({
  account,
  year,
  interestEarned,
  earlyWithdrawalPenalty = 0,
  federalTaxWithheld = 0,
  recipientName,
  recipientAddress = "",
  recipientTin = "***-**-****",
}: TaxFormOptions) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  header(doc, `Form 1099-INT · Tax Year ${year}`, "Interest Income Statement");

  let y = 100;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Payer", 40, y);
  doc.text("Recipient", 316, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text("Glass Bank, N.A.", 40, y);
  doc.text(recipientName, 316, y);
  y += 14;
  doc.text("100 Market Street", 40, y);
  doc.text(recipientAddress || "On file", 316, y);
  y += 14;
  doc.text("San Francisco, CA 94105", 40, y);
  doc.text(`TIN: ${recipientTin}`, 316, y);
  y += 14;
  doc.setTextColor(110, 110, 110);
  doc.text("Payer TIN: 84-1234567", 40, y);
  doc.setTextColor(30, 30, 30);
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Account", 40, y);
  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(40, y, 572, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${account.name} · ${account.accountNumber}`, 40, y);
  y += 30;

  // 1099-INT boxes
  const boxes: [string, string, number][] = [
    ["Box 1", "Interest Income", interestEarned],
    ["Box 2", "Early Withdrawal Penalty", earlyWithdrawalPenalty],
    ["Box 3", "Interest on U.S. Savings Bonds and Treas. obligations", 0],
    ["Box 4", "Federal Income Tax Withheld", federalTaxWithheld],
    ["Box 8", "Tax-Exempt Interest", 0],
  ];

  boxes.forEach(([label, desc, val]) => {
    doc.setFillColor(245, 248, 251);
    doc.rect(40, y, 532, 42, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 42, 68);
    doc.text(label, 56, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);
    doc.text(desc, 100, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(fmt(val), 556, y + 26, { align: "right" });
    y += 50;
  });

  y += 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  const disclosure =
    "This is important tax information and is being furnished to the Internal Revenue Service. If you are required to file a return, a negligence penalty or other sanction may be imposed if this income is taxable and the IRS determines it has not been reported.";
  const wrapped = doc.splitTextToSize(disclosure, 532);
  doc.text(wrapped, 40, y);

  footer(doc);
  triggerDownload(doc, `GlassBank_1099-INT_${year}_${account.name.replace(/\s+/g, "_")}.pdf`);
}
