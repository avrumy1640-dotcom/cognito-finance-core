// Best-effort per-caller rate limiting for edge functions.
//
// Sliding window kept in module memory. Each isolate has its own counters, so
// this is a guard-rail against runaway clients / accidental loops rather than a
// hard distributed quota. It costs nothing and adds no dependency; if we ever
// need strict global limits we'd move the counter into Postgres or Redis.
const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds
}

export function rateLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
    buckets.set(key, hits);
    return { allowed: false, remaining: 0, retryAfter };
  }
  hits.push(now);
  buckets.set(key, hits);
  // Opportunistic cleanup so the map can't grow unbounded across cold isolates.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
    }
  }
  return { allowed: true, remaining: limit - hits.length, retryAfter: 0 };
}

export function tooManyRequests(retryAfter: number, headers: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: "Too many requests — please slow down.", retryAfter }),
    {
      status: 429,
      headers: { ...headers, "Content-Type": "application/json", "Retry-After": String(retryAfter) },
    },
  );
}
