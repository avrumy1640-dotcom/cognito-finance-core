import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plane, CheckCircle2, X, Trash2 } from "lucide-react";
import FlowScreen, { FlowButton } from "@/components/layout/FlowScreen";
import GlassCard from "@/components/glass/GlassCard";
import SearchSelect from "@/components/form/SearchSelect";
import { COUNTRIES } from "@/lib/countries";
import { useCardPrefs } from "@/hooks/useCardPrefs";

const today = () => new Date().toISOString().slice(0, 10);

const TravelNotice = () => {
  const navigate = useNavigate();
  const { prefs, update } = useCardPrefs();

  const [destinations, setDestinations] = useState<string[]>(prefs.travel?.destinations ?? []);
  const [pick, setPick] = useState("");
  const [start, setStart] = useState(prefs.travel?.start ?? today());
  const [end, setEnd] = useState(prefs.travel?.end ?? "");
  const [saved, setSaved] = useState(false);

  const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;

  const addDestination = (code: string) => {
    setPick("");
    if (!code || destinations.includes(code)) return;
    setDestinations((d) => [...d, code]);
  };

  const save = () => {
    if (destinations.length === 0) {
      toast.error("Add at least one destination");
      return;
    }
    if (!end || end < start) {
      toast.error("Choose a return date after your departure");
      return;
    }
    update({ travel: { destinations, start, end } });
    setSaved(true);
    toast.success("Travel notice saved");
  };

  const remove = () => {
    update({ travel: null });
    toast.success("Travel notice removed");
    navigate("/cards");
  };

  if (saved) {
    return (
      <FlowScreen title="Travel notice active" kicker="Card" backTo="/cards">
        <GlassCard elevated className="text-center py-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-success/10 mx-auto flex items-center justify-center">
            <CheckCircle2 size={26} className="text-success" />
          </div>
          <p className="text-base font-semibold text-foreground">We won't block your card abroad</p>
          <p className="text-sm text-muted-foreground leading-relaxed px-4">
            {destinations.map(countryName).join(", ")} · {start} to {end}
          </p>
        </GlassCard>
        <FlowButton onClick={() => navigate("/cards")}>Back to cards</FlowButton>
      </FlowScreen>
    );
  }

  return (
    <FlowScreen
      title="Travel notice"
      kicker="Card"
      subtitle="Tell us where you're going so purchases abroad aren't flagged."
      footer={
        <div className="space-y-2">
          <FlowButton onClick={save}>{prefs.travel ? "Update notice" : "Save travel notice"}</FlowButton>
          {prefs.travel && (
            <FlowButton tone="secondary" onClick={remove}>
              <Trash2 size={16} /> Remove notice
            </FlowButton>
          )}
        </div>
      }
    >
      <GlassCard className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Plane size={18} className="text-primary" />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed min-w-0">
          Foreign transactions still need international payments switched on in Card controls.
        </p>
      </GlassCard>

      <GlassCard className="space-y-3">
        <SearchSelect
          label="Destination"
          value={pick}
          onChange={addDestination}
          placeholder="Search countries"
          options={COUNTRIES.filter((c) => !destinations.includes(c.code)).map((c) => ({
            value: c.code,
            label: c.name,
          }))}
        />
        {destinations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {destinations.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-secondary text-xs font-medium text-foreground"
              >
                {countryName(code)}
                <button
                  onClick={() => setDestinations((d) => d.filter((x) => x !== code))}
                  aria-label={`Remove ${countryName(code)}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Departure</span>
          <input
            type="date"
            value={start}
            min={today()}
            onChange={(e) => setStart(e.target.value)}
            className="w-full h-12 px-3 rounded-xl bg-secondary text-sm text-foreground outline-none"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Return</span>
          <input
            type="date"
            value={end}
            min={start}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full h-12 px-3 rounded-xl bg-secondary text-sm text-foreground outline-none"
          />
        </label>
      </GlassCard>
    </FlowScreen>
  );
};

export default TravelNotice;
