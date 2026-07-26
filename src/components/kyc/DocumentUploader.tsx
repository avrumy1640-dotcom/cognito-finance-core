import { useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, Check, AlertTriangle, RefreshCw, X, FileImage, Sparkles } from "lucide-react";

export interface DocumentSpec {
  id: string;
  label: string;
  description: string;
  /** Advisory tips shown as a checklist above the uploader. */
  tips: string[];
  /** Kind of source — enables the correct picker + guidance. */
  kind: "selfie" | "photo" | "document";
  /** Maximum file size (MB). Default 6. */
  maxMb?: number;
  /** Accepted MIME prefixes. Default depends on kind. */
  accept?: string;
  /** Minimum pixel dimensions on the shorter side (image only). */
  minShortEdge?: number;
}

interface Props {
  spec: DocumentSpec;
  /** Existing data URL (e.g. rehydrated). */
  value?: string | null;
  onChange: (dataUrl: string | null, meta?: { name: string; sizeBytes: number; width?: number; height?: number }) => void;
  /** Provider-side rejection message to surface next to the upload with fix guidance. */
  rejectionReason?: string | null;
  /** Whether this document is required. Adds a required badge. */
  required?: boolean;
}

interface Issue {
  code: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Guided single-document uploader. Handles the picker, preview, and smart
 * client-side validation (size, type, dimensions), and surfaces both local
 * issues and any provider rejection reason with concrete fix guidance.
 */
const DocumentUploader = ({ spec, value, onChange, rejectionReason, required }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [meta, setMeta] = useState<{ name: string; sizeBytes: number; width?: number; height?: number } | null>(null);
  const [validated, setValidated] = useState(!!value);

  const maxMb = spec.maxMb ?? 6;
  const accept = spec.accept ?? (spec.kind === "document" ? "image/*,application/pdf" : "image/*");

  const rejectionHints = useMemo(() => parseRejection(rejectionReason ?? ""), [rejectionReason]);

  const validate = async (file: File): Promise<{ issues: Issue[]; dims?: { width: number; height: number } }> => {
    const list: Issue[] = [];
    if (file.size > maxMb * 1024 * 1024) list.push({ code: "too_big", message: `File is over ${maxMb} MB — pick a smaller photo.`, severity: "error" });
    if (file.size < 20 * 1024) list.push({ code: "too_small", message: "File is very small — the photo may be too low resolution.", severity: "warning" });
    const okType = accept.split(",").some((t) => t.trim() === "*/*" || file.type.startsWith(t.replace("/*", "/")));
    if (!okType) list.push({ code: "bad_type", message: `Unsupported file type (${file.type || "unknown"}).`, severity: "error" });

    let dims: { width: number; height: number } | undefined;
    if (file.type.startsWith("image/")) {
      try {
        dims = await readImageDims(file);
        if (spec.minShortEdge && Math.min(dims.width, dims.height) < spec.minShortEdge) {
          list.push({ code: "too_low_res", message: `Resolution is low (${dims.width}×${dims.height}). Move closer or use a higher-quality camera.`, severity: "warning" });
        }
      } catch {
        list.push({ code: "unreadable", message: "We couldn't read this image. Try another photo.", severity: "error" });
      }
    }
    return { issues: list, dims };
  };

  const handleFile = async (file: File) => {
    const { issues: found, dims } = await validate(file);
    setIssues(found);
    if (found.some((i) => i.severity === "error")) {
      setValidated(false);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const info = { name: file.name, sizeBytes: file.size, width: dims?.width, height: dims?.height };
      setMeta(info);
      setValidated(true);
      onChange(url, info);
    };
    reader.readAsDataURL(file);
  };

  const clear = () => {
    setIssues([]);
    setMeta(null);
    setValidated(false);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const hasError = issues.some((i) => i.severity === "error");
  const hasRejection = !!rejectionReason && !validated;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{spec.label}</span>
        {required && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
            Required
          </span>
        )}
        {validated && !hasError && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-success/15 text-success flex items-center gap-1">
            <Check size={10} /> Ready
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground -mt-1">{spec.description}</p>

      {/* Tips checklist */}
      <div className="rounded-xl bg-secondary/60 p-3 space-y-1.5">
        {spec.tips.map((t) => (
          <div key={t} className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <Sparkles size={11} className="text-primary mt-0.5 shrink-0" />
            <span>{t}</span>
          </div>
        ))}
      </div>

      {/* Provider rejection surface */}
      <AnimatePresence>
        {hasRejection && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-destructive/30 bg-destructive/5 p-3"
          >
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold">Previously rejected</p>
                <p className="text-[11px] mt-1 opacity-90">{rejectionReason}</p>
              </div>
            </div>
            {rejectionHints.length > 0 && (
              <ul className="mt-2 space-y-1 pl-6 list-disc text-[11px] text-destructive/90">
                {rejectionHints.map((h) => <li key={h}>{h}</li>)}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Uploader — the dashed box itself is the trigger for the hidden input */}
      <div
        role="button"
        tabIndex={0}
        aria-label={value ? `Replace ${spec.label}` : `Upload ${spec.label}`}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer?.files?.[0];
          if (f) void handleFile(f);
        }}
        className={`w-full cursor-pointer select-none rounded-2xl border-2 border-dashed p-5 flex flex-col items-center gap-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
          hasError
            ? "border-destructive/50 bg-destructive/5"
            : dragging
            ? "border-primary bg-primary/10"
            : validated
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-border/80"
        }`}
      >
        {value ? (
          spec.kind === "selfie" ? (
            <img src={value} alt="Selfie preview" className="w-24 h-24 rounded-full object-cover shadow-lg pointer-events-none" />
          ) : (
            <img src={value} alt="Document preview" className="max-h-40 rounded-xl object-cover shadow-lg pointer-events-none" />
          )
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center pointer-events-none">
            {spec.kind === "selfie" ? <Camera size={24} className="text-primary" />
              : spec.kind === "document" ? <FileImage size={24} className="text-primary" />
              : <Upload size={24} className="text-primary" />}
          </div>
        )}
        <div className="text-center pointer-events-none">
          <div className="text-sm font-semibold text-foreground">
            {value ? "Tap to replace" : spec.kind === "selfie" ? "Take a selfie" : "Upload a photo"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {meta ? `${prettyBytes(meta.sizeBytes)}${meta.width ? ` · ${meta.width}×${meta.height}` : ""}` : `Up to ${maxMb} MB`}
          </div>
        </div>
      </div>
      {/*
        Kept in the layout (not display:none) and visually hidden instead —
        some mobile browsers refuse to open the picker for a display:none input.
      */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={spec.kind === "selfie" ? "user" : undefined}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only absolute w-px h-px opacity-0 pointer-events-none"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />


      {/* Live validation issues */}
      <AnimatePresence>
        {issues.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5">
            {issues.map((i) => (
              <div key={i.code} className={`flex items-start gap-2 text-[11px] p-2.5 rounded-lg ${
                i.severity === "error" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning-foreground"
              }`}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span className="flex-1">{i.message}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {value && (
        <div className="flex gap-2">
          <button type="button" onClick={() => inputRef.current?.click()}
            className="flex-1 py-2 px-3 rounded-lg bg-secondary text-foreground text-xs font-semibold flex items-center justify-center gap-1.5">
            <RefreshCw size={12} /> Retake
          </button>
          <button type="button" onClick={clear}
            className="py-2 px-3 rounded-lg bg-secondary text-muted-foreground text-xs font-semibold flex items-center gap-1.5">
            <X size={12} /> Remove
          </button>
        </div>
      )}
    </div>
  );
};

function readImageDims(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("read failed")); };
    img.src = url;
  });
}

function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Turn a freeform provider rejection reason into concrete, user-friendly fix hints. */
function parseRejection(reason: string): string[] {
  const t = reason.toLowerCase();
  const hints: string[] = [];
  if (!reason) return hints;
  if (/blur|blurry|focus|sharp/.test(t)) hints.push("Hold the camera still and tap to focus before capturing.");
  if (/glare|shine|reflection|light/.test(t)) hints.push("Move away from direct light or glossy surfaces.");
  if (/dark|dim|shadow/.test(t)) hints.push("Take the photo in a brighter, evenly-lit room.");
  if (/crop|edge|corner|cut/.test(t)) hints.push("Make sure all four corners of the document are visible.");
  if (/expired|expire/.test(t)) hints.push("Upload a document that hasn't expired.");
  if (/mismatch|name|date|birth/.test(t)) hints.push("Confirm the details on your form match your ID exactly.");
  if (/face|selfie|match/.test(t)) hints.push("Take a straight-on selfie, no hat or sunglasses, clearly showing your face.");
  if (hints.length === 0) hints.push("Retake the photo following the tips above and resubmit.");
  return hints;
}

export default DocumentUploader;
