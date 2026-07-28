// Per-category monthly budgets. Local to the demo ledger — stored alongside
// it in localStorage so budgets survive reloads without a backend.
const KEY = "glassbank.budgets.v1";

export type Budgets = Record<string, number>;

export function loadBudgets(): Budgets {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Budgets) : {};
  } catch {
    return {};
  }
}

export function saveBudgets(b: Budgets) {
  try {
    localStorage.setItem(KEY, JSON.stringify(b));
  } catch {
    /* private mode — budgets stay in memory for this session */
  }
}
