/* ============================================================
   Token-bucket rate limiter.

   Chosen over a fixed window because a fixed window lets a caller
   fire 2x the quota across a window boundary. A token bucket
   refills continuously, so it enforces an average rate while still
   allowing a short legitimate burst — and it needs only two numbers
   per caller (tokens, lastRefill) rather than a list of timestamps.

   SCOPE, STATED PLAINLY: this is per serverless instance. Vercel
   may run several concurrent instances, so the effective ceiling is
   (instances x capacity). That is fine for spam control on a
   contact form. If this ever guards something that must be exact,
   move the bucket into Redis/Upstash — the interface below does not
   change, only the storage.
============================================================ */

"use strict";

const { TTLCache } = require("./cache");

// Bounded: at most 5,000 tracked callers, each forgotten after an
// hour of silence. An attacker rotating IPs evicts their own
// entries rather than growing the process heap without limit.
const buckets = new TTLCache(5000, 60 * 60 * 1000);

/**
 * @param {string} key       caller identity (usually client IP)
 * @param {number} capacity  max burst
 * @param {number} refillPerSec  sustained rate
 * @returns {{allowed:boolean, retryAfter:number, remaining:number}}
 */
function take(key, capacity = 8, refillPerSec = 8 / 900) {
  const now = Date.now();
  const bucket = buckets.get(key) || { tokens: capacity, last: now };

  // Continuous refill, clamped at capacity.
  const elapsedSec = (now - bucket.last) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
  bucket.last = now;

  if (bucket.tokens < 1) {
    const deficit = 1 - bucket.tokens;
    buckets.set(key, bucket);
    return {
      allowed: false,
      retryAfter: Math.ceil(deficit / refillPerSec),
      remaining: 0
    };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return {
    allowed: true,
    retryAfter: 0,
    remaining: Math.floor(bucket.tokens)
  };
}

/**
 * Client IP. On Vercel the platform sets x-forwarded-for and the
 * left-most entry is the real client; trusting a header is only
 * safe because the platform rewrites it at the edge.
 */
function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length) return String(xff[0]).trim();
  return (
    req.headers["x-real-ip"] ||
    (req.socket && req.socket.remoteAddress) ||
    "unknown"
  );
}

module.exports = { take, clientIp };
