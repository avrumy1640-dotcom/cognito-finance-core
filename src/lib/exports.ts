// CSV + PDF export helpers with preview and audit trail metadata.
import jsPDF from "jspdf";

export interface ExportRow {
  [key: string]: string | number;
}

export interface ExportResult {
  filename: string;
  mime: string;
  size: number;
  rows: number;
  previewText: string;      // first ~10 rows for preview modal
  download: () => void;      // triggers browser download
  confirmationCode: string;  // audit-friendly reference
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

const shortRef = () =>
  "EXP-" + Math.random().toString(36).slice(2, 8).toUpperCase() +
  "-" + Date.now().toString(36).toUpperCase().slice(-4);

export const buildCsv = (
  filenameBase: string,
  headers: string[],
  rows: ExportRow[]
): ExportResult => {
  const csvRows = [
    headers,
    ...rows.map((r) => headers.map((h) => r[h] ?? "")),
  ];
  const csv = csvRows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const filename = `${filenameBase}-${stamp()}.csv`;
  return {
    filename,
    mime: "text/csv",
    size: blob.size,
    rows: rows.length,
    previewText: csv.split("\n").slice(0, 11).join("\n"),
    confirmationCode: shortRef(),
    download: () => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
};

export const buildPdf = (
  filenameBase: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: ExportRow[]
): ExportResult => {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 40;
  let y = 56;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, marginX, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(subtitle, marginX, y);
  y += 24;
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const colWidth = (612 - marginX * 2) / headers.length;
  headers.forEach((h, i) => doc.text(h, marginX + i * colWidth, y));
  y += 4;
  doc.setDrawColor(200);
  doc.line(marginX, y, 612 - marginX, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  rows.forEach((r) => {
    if (y > 740) { doc.addPage(); y = 56; }
    headers.forEach((h, i) => {
      const val = String(r[h] ?? "");
      doc.text(val.length > 30 ? val.slice(0, 27) + "…" : val, marginX + i * colWidth, y);
    });
    y += 14;
  });
  const ref = shortRef();
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(`Confirmation ${ref} · Generated ${new Date().toLocaleString()}`, marginX, 770);
  const blob = doc.output("blob");
  const filename = `${filenameBase}-${stamp()}.pdf`;
  return {
    filename,
    mime: "application/pdf",
    size: blob.size,
    rows: rows.length,
    previewText: [headers.join(" · "), ...rows.slice(0, 10).map((r) => headers.map((h) => r[h]).join(" · "))].join("\n"),
    confirmationCode: ref,
    download: () => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
};

export const humanBytes = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;
