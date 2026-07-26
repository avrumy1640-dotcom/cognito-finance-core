import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, RefreshCw, Check, AlertTriangle, Upload } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Receives a JPEG data URL plus basic metadata, matching the uploader contract. */
  onCapture: (dataUrl: string, meta: { name: string; sizeBytes: number; width: number; height: number }) => void;
  /** Called when the user chooses the file-picker fallback. */
  onFallback: () => void;
}

type Phase = "starting" | "live" | "review" | "error";

interface CamError {
  title: string;
  message: string;
  hint?: string;
}

const MAX_EDGE = 1280;
const QUALITY = 0.85;

function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function describeError(err: unknown): CamError {
  const name = (err as { name?: string } | null)?.name ?? "";
  const framed = inIframe();
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      title: "Camera permission blocked",
      message: framed
        ? "This app is running inside an embedded preview that hasn't been granted camera access, or you dismissed the permission prompt."
        : "You (or your browser) blocked camera access for this site.",
      hint: framed
        ? "Open the app in its own browser tab and allow the camera, or upload a photo instead."
        : "Tap the lock/camera icon in your browser's address bar, set Camera to Allow, then reload and try again.",
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return {
      title: "No camera found",
      message: "We couldn't find a front-facing camera on this device.",
      hint: "Upload a photo instead, or try again on a phone with a selfie camera.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      title: "Camera is busy",
      message: "Another app or browser tab is already using the camera.",
      hint: "Close anything else using the camera, then try again.",
    };
  }
  return {
    title: "Couldn't start the camera",
    message: (err as { message?: string } | null)?.message || "An unexpected error stopped the camera from opening.",
    hint: "You can upload a photo instead.",
  };
}

const SelfieCapture = ({ open, onClose, onCapture, onFallback }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<CamError | null>(null);
  const [shot, setShot] = useState<{ url: string; width: number; height: number; sizeBytes: number } | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setShot(null);
    setPhase("starting");

    if (!window.isSecureContext) {
      setError({
        title: "Secure connection required",
        message: "Browsers only allow camera access over HTTPS.",
        hint: "Open the app over https:// or upload a photo instead.",
      });
      setPhase("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({
        title: "Camera not supported",
        message: inIframe()
          ? "This embedded preview blocks camera access (missing allow=\"camera\" permission on the frame)."
          : "This browser doesn't support in-app camera capture.",
        hint: "Upload a photo instead, or open the app in a modern mobile browser.",
      });
      setPhase("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      setPhase("live");
    } catch (err) {
      stopStream();
      setError(describeError(err));
      setPhase("error");
    }
  }, [stopStream]);

  useEffect(() => {
    if (open) void start();
    else stopStream();
    return () => stopStream();
  }, [open, start, stopStream]);

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror to match the preview the user sees.
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, w, h);
    let url = canvas.toDataURL("image/jpeg", QUALITY);
    let bytes = Math.round((url.length - url.indexOf(",") - 1) * 0.75);
    let q = QUALITY;
    while (bytes > 6 * 1024 * 1024 && q > 0.4) {
      q -= 0.15;
      url = canvas.toDataURL("image/jpeg", q);
      bytes = Math.round((url.length - url.indexOf(",") - 1) * 0.75);
    }
    setShot({ url, width: w, height: h, sizeBytes: bytes });
    setPhase("review");
    stopStream();
  };

  const close = () => {
    stopStream();
    setShot(null);
    setPhase("starting");
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Take a selfie"
      >
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <span className="text-sm font-semibold text-foreground">Take a selfie</span>
          <button
            type="button"
            onClick={close}
            aria-label="Close camera"
            className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            data-testid="selfie-video"
            className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${
              phase === "live" ? "opacity-100" : "opacity-0"
            }`}
          />

          {phase === "live" && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[62%] aspect-[3/4] rounded-[50%] border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              <p className="absolute bottom-6 text-xs text-white/80 font-medium">
                Center your face in the oval
              </p>
            </div>
          )}

          {phase === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Camera size={28} className="animate-pulse text-primary" />
              <p className="text-xs">Starting camera…</p>
            </div>
          )}

          {phase === "review" && shot && (
            <img src={shot.url} alt="Selfie preview" className="absolute inset-0 w-full h-full object-cover" />
          )}

          {phase === "error" && error && (
            <div className="absolute inset-0 p-5 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle size={22} className="text-destructive" />
              </div>
              <p data-testid="selfie-error-title" className="text-sm font-semibold text-foreground">{error.title}</p>
              <p className="text-xs text-muted-foreground max-w-xs">{error.message}</p>
              {error.hint && <p className="text-[11px] text-muted-foreground/80 max-w-xs">{error.hint}</p>}
            </div>
          )}
        </div>

        <div className="shrink-0 p-5 pb-8 space-y-3">
          {phase === "live" && (
            <button
              type="button"
              onClick={capture}
              aria-label="Capture selfie"
              data-testid="selfie-shutter"
              className="mx-auto block w-[72px] h-[72px] rounded-full bg-primary ring-4 ring-primary/25 active:scale-95 transition-transform"
            />
          )}

          {phase === "review" && shot && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void start()}
                className="flex-1 py-3 rounded-2xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} /> Retake
              </button>
              <button
                type="button"
                data-testid="selfie-use"
                onClick={() => {
                  onCapture(shot.url, {
                    name: "selfie.jpg",
                    sizeBytes: shot.sizeBytes,
                    width: shot.width,
                    height: shot.height,
                  });
                  close();
                }}
                className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Check size={15} /> Use photo
              </button>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void start()}
                className="w-full py-3 rounded-2xl bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2"
              >
                <RefreshCw size={15} /> Try again
              </button>
              <button
                type="button"
                data-testid="selfie-fallback"
                onClick={() => {
                  close();
                  onFallback();
                }}
                className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Upload size={15} /> Upload a photo instead
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default SelfieCapture;
