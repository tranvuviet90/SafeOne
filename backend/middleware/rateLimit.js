// Minimal in-memory fixed-window rate limiter (no external dependency).
// Suitable for a single-instance deployment. If you scale to multiple instances,
// replace the in-memory Map with a shared store (e.g. Redis).
const buckets = new Map();
let limiterSeq = 0;

export function rateLimit({
  windowMs = 15 * 60 * 1000,
  max = 10,
  message = "Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút."
} = {}) {
  // Mỗi limiter một namespace riêng: trước đây mọi limiter dùng chung bucket theo IP,
  // nên số lần thử login bị cộng dồn vào cả forgot-password (và ngược lại).
  const ns = `l${limiterSeq++}:`;
  return (req, res, next) => {
    const key = ns + (req.ip || req.socket?.remoteAddress || "unknown");
    const now = Date.now();
    let entry = buckets.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// Periodically purge expired buckets so memory stays bounded.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (now > v.resetAt) buckets.delete(k);
  }
}, 10 * 60 * 1000);
sweeper.unref?.();
