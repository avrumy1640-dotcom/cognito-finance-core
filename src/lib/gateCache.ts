// Session-scoped cache for the cheap-but-chatty gate reads (onboarding state,
// KYC row, MFA assurance level). These answers change at most a couple of times
// in a session, but they were previously re-fetched on EVERY route change,
// which put 2-4 blocking round-trips in front of every navigation.
//
// The cache is keyed by user id, deduplicates concurrent callers onto one
// in-flight promise, and exposes an explicit `invalidate` for the flows that
// actually change the answer (finishing onboarding, submitting KYC, signing
// out).

type Loader<T> = () => Promise<T>;

interface Entry<T> {
  value?: T;
  at: number;
  inflight?: Promise<T>;
}

const store = new Map<string, Entry<unknown>>();
const listeners = new Set<() => void>();

/** Notify subscribers (hooks) that cached data changed. */
function emit() {
  listeners.forEach((l) => l());
}

export function subscribeGateCache(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function peekCached<T>(key: string): T | undefined {
  return store.get(key)?.value as T | undefined;
}

/**
 * Returns the cached value when fresh, otherwise fetches (deduplicated).
 * `maxAgeMs` of Infinity means "cache until explicitly invalidated".
 */
export function cachedFetch<T>(key: string, loader: Loader<T>, maxAgeMs = Infinity): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit?.inflight) return hit.inflight;
  if (hit && hit.value !== undefined && Date.now() - hit.at < maxAgeMs) {
    return Promise.resolve(hit.value);
  }
  const inflight = loader()
    .then((value) => {
      store.set(key, { value, at: Date.now() });
      emit();
      return value;
    })
    .catch((err) => {
      store.delete(key);
      throw err;
    });
  store.set(key, { ...(hit ?? { at: 0 }), inflight } as Entry<unknown>);
  return inflight;
}

/** Drop one key, every key with a prefix, or the whole cache. */
export function invalidateGateCache(prefix?: string) {
  if (!prefix) store.clear();
  else for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
  emit();
}
