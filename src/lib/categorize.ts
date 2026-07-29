// Real transaction categorization.
//
// Two layers:
//  1. A merchant-name normalizer that strips payment-processor prefixes, store
//     numbers, city/state tails, reference ids and punctuation noise.
//  2. A rules engine driven by `transaction_category_rules` in the database
//     (regex pattern -> category, ordered by priority). A compiled built-in
//     copy of the default rules is used until the DB rules load, so the first
//     paint is never "Type 3".
//
// Persisted results live in `transaction_categories`, keyed by the
// transaction reference, so a category never changes underneath the user. A
// row with `is_override = true` always wins over the rules engine.

import { supabase } from "@/integrations/supabase/client";

export const CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Housing",
  "Health",
  "Entertainment",
  "Travel",
  "Income",
  "Transfers",
  "Fees",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_ICON: Record<string, string> = {
  Groceries: "🛒",
  Dining: "🍽️",
  Transport: "🚗",
  Shopping: "🛍️",
  "Bills & Utilities": "💡",
  Housing: "🏠",
  Health: "🩺",
  Entertainment: "🎬",
  Travel: "✈️",
  Income: "💰",
  Transfers: "↔️",
  Fees: "🏷️",
  Other: "💳",
};

export interface CategoryRule {
  pattern: string;
  category: string;
  priority: number;
}

// Mirror of the seeded rows in transaction_category_rules. Kept in sync as a
// cold-start fallback only — the database copy is authoritative once loaded.
const BUILTIN_RULES: CategoryRule[] = [
  { pattern: "payroll|salary|direct deposit|paycheck|employer|interest payment|dividend|refund|reimburs", category: "Income", priority: 5 },
  { pattern: "fee|charge|commission|service charge|overdraft|atm fee|maintenance fee", category: "Fees", priority: 5 },
  { pattern: "whole foods|trader joe|safeway|kroger|aldi|lidl|tesco|sainsbury|publix|wegmans|costco|grocer|supermarket|food market|instacart", category: "Groceries", priority: 10 },
  { pattern: "starbucks|dunkin|blue bottle|mcdonald|burger|pizza|chipotle|sweetgreen|restaurant|cafe|coffee|bistro|doordash|ubereats|uber eats|grubhub|deliveroo|bar & grill", category: "Dining", priority: 10 },
  { pattern: "uber|lyft|bolt|taxi|cab|transit|metro|subway rail|amtrak|shell|chevron|exxon|bp fuel|petrol|gas station|parking|toll", category: "Transport", priority: 10 },
  { pattern: "electric|utility|utilities|water co|comcast|xfinity|verizon|at&t|t-mobile|vodafone|internet|broadband|phone bill|pg&e|con ed|energy", category: "Bills & Utilities", priority: 10 },
  { pattern: "rent|landlord|mortgage|hoa|property mgmt|leasing", category: "Housing", priority: 10 },
  { pattern: "pharmacy|cvs|walgreens|clinic|hospital|dental|dentist|doctor|medical|health|insurance premium", category: "Health", priority: 10 },
  { pattern: "netflix|spotify|hulu|disney|hbo|max stream|youtube|prime video|playstation|xbox|steam|twitch|cinema|movie|concert|ticketmaster", category: "Entertainment", priority: 10 },
  { pattern: "airline|airways|flight|hotel|booking\\.com|airbnb|expedia|marriott|hilton|delta air|united air|ryanair|easyjet|travel", category: "Travel", priority: 10 },
  { pattern: "amazon|ebay|walmart|target|best buy|etsy|shein|zara|h&m|nike|adidas|apple store|shop|store", category: "Shopping", priority: 30 },
  { pattern: "transfer|zelle|venmo|cash app|paypal|wire|ach|sepa|swift|internal", category: "Transfers", priority: 40 },
];

// Payment-processor and acquirer prefixes that carry no merchant meaning.
const PROCESSOR_PREFIXES = [
  "sq", "sq *", "sqc", "tst", "tst*", "pos", "pos debit", "purchase", "payment",
  "paypal", "pp", "pp*", "stripe", "sumup", "izettle", "toast", "clover",
  "visa", "mastercard", "mc", "debit card purchase", "card purchase",
  "recurring payment", "ach debit", "ach credit", "web pymt", "webpay",
  "checkcard", "point of sale", "int'l", "intl",
];

/**
 * Turn a raw counterparty string into a readable merchant name.
 * "SQ *BLUE BOTTLE COFFEE #4821 SAN FRANCISCOCA 8005551234" -> "Blue Bottle Coffee"
 */
export function normalizeMerchant(raw: string): string {
  if (!raw) return "";
  let s = String(raw).toLowerCase().trim();

  // Strip processor prefixes, possibly stacked ("pos debit sq *foo").
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of PROCESSOR_PREFIXES) {
      const prefix = p.endsWith("*") ? p : `${p} `;
      if (s.startsWith(prefix)) {
        s = s.slice(prefix.length).trim();
        changed = true;
      }
      if (s.startsWith(`${p}*`)) {
        s = s.slice(p.length + 1).trim();
        changed = true;
      }
    }
  }

  s = s
    // Store / terminal numbers: "#4821", "store 221", "- 00123"
    .replace(/#\s*\d+/g, " ")
    .replace(/\bstore\s*\d+\b/g, " ")
    .replace(/\bterm(inal)?\s*\d+\b/g, " ")
    // Long digit runs (reference ids, phone numbers, card tails)
    .replace(/\b\d{4,}\b/g, " ")
    // Dates embedded in descriptors
    .replace(/\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/g, " ")
    // Trailing "CITY ST" style tails
    .replace(/\b[a-z]{2}\s*$/, (m) => (m.trim().length === 2 ? " " : m))
    // Punctuation noise
    .replace(/[*_|~^]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!s) return String(raw).trim();
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

let cachedRules: CategoryRule[] | null = null;

export async function loadCategoryRules(): Promise<CategoryRule[]> {
  if (cachedRules) return cachedRules;
  try {
    const { data } = await supabase
      .from("transaction_category_rules")
      .select("pattern, category, priority")
      .eq("active", true)
      .order("priority", { ascending: true });
    cachedRules = data && data.length > 0 ? (data as CategoryRule[]) : BUILTIN_RULES;
  } catch {
    cachedRules = BUILTIN_RULES;
  }
  return cachedRules;
}

export function getLoadedRules(): CategoryRule[] {
  return cachedRules ?? BUILTIN_RULES;
}

/**
 * Derive a category from the (normalized) counterparty name and the direction
 * of the transaction. Returns "Other" when nothing matches — never a fake
 * placeholder like `Type 3`.
 */
export function categorize(
  rawMerchant: string,
  direction: "credit" | "debit",
  rules: CategoryRule[] = getLoadedRules(),
): { category: string; merchant: string } {
  const merchant = normalizeMerchant(rawMerchant);
  const haystack = `${merchant} ${rawMerchant}`.toLowerCase();
  const ordered = [...rules].sort((a, b) => a.priority - b.priority);
  for (const rule of ordered) {
    let re: RegExp;
    try {
      re = new RegExp(rule.pattern, "i");
    } catch {
      continue;
    }
    if (re.test(haystack)) {
      // An inbound payment that matched a spend rule is still income-ish; only
      // trust spend categories on debits.
      if (direction === "credit" && !["Income", "Transfers", "Fees"].includes(rule.category)) {
        continue;
      }
      return { category: rule.category, merchant };
    }
  }
  return { category: direction === "credit" ? "Income" : "Other", merchant };
}

export interface StoredCategory {
  category: string;
  is_override: boolean;
}

/** Read every persisted category for the signed-in user, keyed by tx reference. */
export async function fetchStoredCategories(userId: string): Promise<Map<string, StoredCategory>> {
  const map = new Map<string, StoredCategory>();
  const { data } = await supabase
    .from("transaction_categories")
    .select("transaction_ref, category, is_override")
    .eq("user_id", userId)
    .limit(5000);
  for (const row of (data ?? []) as Array<{ transaction_ref: string; category: string; is_override: boolean }>) {
    map.set(row.transaction_ref, { category: row.category, is_override: row.is_override });
  }
  return map;
}

/** Persist rule-derived categories (never clobbers a user override). */
export async function persistDerivedCategories(
  userId: string,
  rows: Array<{ transaction_ref: string; category: string; merchant_normalized: string }>,
  existing: Map<string, StoredCategory>,
): Promise<void> {
  const toWrite = rows.filter((r) => {
    const prior = existing.get(r.transaction_ref);
    if (!prior) return true;
    return !prior.is_override && prior.category !== r.category;
  });
  if (toWrite.length === 0) return;
  await supabase
    .from("transaction_categories")
    .upsert(
      toWrite.map((r) => ({ ...r, user_id: userId, is_override: false })),
      { onConflict: "user_id,transaction_ref" },
    );
}

/** User override — always wins over the rules engine. */
export async function setCategoryOverride(
  userId: string,
  transactionRef: string,
  category: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("transaction_categories")
    .upsert(
      { user_id: userId, transaction_ref: transactionRef, category, is_override: true },
      { onConflict: "user_id,transaction_ref" },
    );
  return { error: error?.message ?? null };
}
