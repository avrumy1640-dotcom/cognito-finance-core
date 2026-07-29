import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Database, FlaskConical, Trash2 } from "lucide-react";

import GlassCard from "@/components/glass/GlassCard";
import ConfirmDialog from "@/components/glass/ConfirmDialog";
import { useRoles } from "@/hooks/useRole";
import {
  ledgerProvider,
  getDataSource,
  setDataSource,
  type DataSource,
} from "@/lib/ledgerProvider";

const TAPS_TO_UNLOCK = 7;
const TAP_WINDOW_MS = 2500;

/**
 * Hidden developer menu.
 *
 * Rendered as an innocuous version string. Tapping it 7 times in quick
 * succession reveals the data-source switch — and ONLY for users holding the
 * admin role. A normal investor-demo user who taps it sees nothing at all: no
 * toast, no hint, no menu. Mock data stays the default for everyone.
 */
const DevDataSourceMenu = () => {
  const { isAdmin } = useRoles();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<DataSource>(getDataSource());
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);
  const taps = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const registerTap = () => {
    taps.current += 1;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { taps.current = 0; }, TAP_WINDOW_MS);
    if (taps.current < TAPS_TO_UNLOCK) return;
    taps.current = 0;
    // Silently ignored for non-admins — the menu must be unreachable in a demo.
    if (!isAdmin) return;
    setOpen((v) => !v);
  };

  const switchSource = (next: DataSource) => {
    setSource(next);
    setDataSource(next);
    toast.success(next === "live" ? "Live sandbox mode" : "Mock data mode", {
      description: "Reload the app to re-hydrate balances from the new source.",
    });
  };

  const wipe = async () => {
    setConfirmWipe(false);
    setWiping(true);
    const id = toast.loading("Deleting all sandbox test data…");
    try {
      const res = await ledgerProvider.adminWipe(false);
      const failed = res.results.filter((r) => !r.ok).length;
      toast.success(`Deleted ${res.wiped - failed} object(s)`, {
        id,
        description: failed ? `${failed} could not be deleted` : "Sandbox is clean.",
      });
    } catch (e) {
      toast.error("Wipe failed", { id, description: (e as Error).message });
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="pt-2">
      <p
        onClick={registerTap}
        className="text-center text-xs text-muted-foreground select-none cursor-default"
      >
        Glass Bank v2.1.0 · Build 2026.03
      </p>

      {open && isAdmin && (
        <GlassCard className="mt-3 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-primary" />
            <p className="text-sm font-semibold text-foreground">Developer · Data source</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "demo", label: "Mock data", hint: "Default" },
              { key: "live", label: "Live sandbox", hint: "Test only" },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                onClick={() => switchSource(opt.key)}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  source === opt.key
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary/40"
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Database size={14} /> {opt.label}
                </span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">{opt.hint}</span>
              </button>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Mock data is the default for every user and is never affected by this switch on other
            devices — the preference is local to this browser.
          </p>

          <button
            onClick={() => setConfirmWipe(true)}
            disabled={wiping || source !== "live"}
            className="w-full h-11 rounded-xl bg-destructive/10 text-destructive text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Trash2 size={15} /> Reset / delete all sandbox test data
          </button>
          {source !== "live" && (
            <p className="text-[11px] text-muted-foreground text-center -mt-2">
              Enable live sandbox mode to use the reset action.
            </p>
          )}
        </GlassCard>
      )}

      <ConfirmDialog
        open={confirmWipe}
        onOpenChange={setConfirmWipe}
        title="Delete all sandbox test data?"
        description="Removes every counterparty, bank account and entity created in the provider sandbox, and clears the local mirror tables. Mock demo data is untouched."
        confirmLabel="Delete test data"
        destructive
        onConfirm={() => void wipe()}
      />
    </div>
  );
};

export default DevDataSourceMenu;
