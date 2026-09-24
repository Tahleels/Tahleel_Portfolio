/* ============================================================
   In-process caching primitives for the serverless handlers.

   These sit BEHIND the CDN, not instead of it. The CDN absorbs
   the overwhelming majority of traffic; these three structures
   protect the upstream API from the requests that still get
   through (cold regions, cache misses, revalidation storms).

     TTLCache     bounded LRU + expiry    O(1) get/set
     singleFlight concurrent de-duplication
     lastGood     stale-on-error snapshot
============================================================ */

"use strict";

/**
 * Bounded LRU cache with per-entry TTL.
 *
 * Backed by a Map, which iterates in insertion order — so
 * "delete then re-set on read" promotes an entry to the newest
 * position, and the oldest key is always `keys().next()`.
 * Both get and set stay O(1); memory is hard-capped by `max`,
 * so a flood of distinct keys can never exhaust the instance.
 */
class TTLCache {
  constructor(max = 500, ttlMs = 600000) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;

    if (hit.expires <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }

    // promote to most-recently-used
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key, value, ttlMs) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.max) {
      // evict least-recently-used
      this.map.delete(this.map.keys().next().value);
    }
    this.map.set(key, {
      value,
      expires: Date.now() + (ttlMs || this.ttlMs)
    });
  }
}

/**
 * Request coalescing (single-flight).
 *
 * Without this, N concurrent cache misses become N upstream calls
 * — the classic cache-stampede that turns a traffic spike into a
 * rate-limit ban. Here the first caller does the work and every
 * concurrent caller for the same key awaits that same promise, so
 * upstream sees exactly one request no matter how many arrive.
 */
const inFlight = new Map();

function singleFlight(key, producer) {
  const running = inFlight.get(key);
  if (running) return running;

  const p = Promise.resolve()
    .then(producer)
    .finally(() => inFlight.delete(key));

  inFlight.set(key, p);
  return p;
}

/**
 * Last-known-good snapshot, kept separately from the TTL cache so
 * it survives expiry. If upstream breaks, serving slightly stale
 * data beats serving an error.
 */
const lastGood = new Map();

module.exports = { TTLCache, singleFlight, lastGood };
