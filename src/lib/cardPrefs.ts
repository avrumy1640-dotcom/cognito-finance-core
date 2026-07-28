// Local card preferences that the demo ledger doesn't model: travel notices,
// PIN change timestamps, and wallet provisioning. Persisted per device so the
// UI can reflect real state instead of firing a throwaway toast.

const KEY = "gb_card_prefs";

export interface TravelNotice {
  destinations: string[];
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd
}

export interface CardPrefs {
  travel: TravelNotice | null;
  pinUpdatedAt: string | null;
  walletProvisionedAt: string | null;
  shipToOverride: string | null;
}

const EMPTY: CardPrefs = {
  travel: null,
  pinUpdatedAt: null,
  walletProvisionedAt: null,
  shipToOverride: null,
};

export function getCardPrefs(): CardPrefs {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<CardPrefs>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function setCardPrefs(patch: Partial<CardPrefs>): CardPrefs {
  const next = { ...getCardPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("gb:card-prefs", { detail: next }));
  return next;
}

/** A travel notice only counts while today falls inside its window. */
export function isTravelActive(prefs: CardPrefs = getCardPrefs()): boolean {
  if (!prefs.travel) return false;
  const today = new Date().toISOString().slice(0, 10);
  return prefs.travel.start <= today && today <= prefs.travel.end;
}
