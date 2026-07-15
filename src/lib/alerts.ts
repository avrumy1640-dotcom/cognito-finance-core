// Alert thresholds & preferences for real-time Column-backed alerts.
// Persisted in localStorage; read+written by the notifications settings page and the bank store.

export interface AlertPrefs {
  enabled: boolean;
  largeTxnAmount: number;   // absolute dollars, e.g. 500 => alert on any tx >= $500
  lowBalance: number;       // dollars, e.g. 100 => alert when available < $100
  cardActivity: boolean;    // any card txn or lock/unlock event
  pushDeposits: boolean;
  pushTransfers: boolean;
  pollSeconds: number;      // background poll cadence
}

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  enabled: true,
  largeTxnAmount: 500,
  lowBalance: 100,
  cardActivity: true,
  pushDeposits: true,
  pushTransfers: true,
  pollSeconds: 30,
};

const KEY = "glassbank_alert_prefs";

export const loadAlertPrefs = (): AlertPrefs => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_ALERT_PREFS, ...JSON.parse(raw) } : DEFAULT_ALERT_PREFS;
  } catch {
    return DEFAULT_ALERT_PREFS;
  }
};

export const saveAlertPrefs = (p: AlertPrefs) => {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
};
