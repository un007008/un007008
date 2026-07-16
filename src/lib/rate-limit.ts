/**
 * Naive in-memory sliding-window rate limiter (per key, resets on redeploy).
 * Enough for a single-instance deployment; swap for Redis when scaling out.
 */

type Entry = { count: number; windowStart: number };

export function createRateLimiter(opts: { windowMs: number; max: number; maxKeys?: number }) {
  const hits = new Map<string, Entry>();
  const maxKeys = opts.maxKeys ?? 5000;

  function limited(key: string): boolean {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.windowStart > opts.windowMs) {
      // evict expired/oldest entries instead of clearing everything —
      // a full clear would reset active abusers along with everyone else
      if (hits.size >= maxKeys) {
        hits.forEach((e, k) => {
          if (now - e.windowStart > opts.windowMs) hits.delete(k);
        });
        if (hits.size >= maxKeys) {
          const oldest = hits.keys().next().value;
          if (oldest !== undefined) hits.delete(oldest);
        }
      }
      hits.set(key, { count: 1, windowStart: now });
      return false;
    }
    entry.count += 1;
    return entry.count > opts.max;
  }

  limited.reset = (key: string) => {
    hits.delete(key);
  };
  return limited;
}
