# Architecture

**Written for:** whoever maintains or reviews this repo next — including a future you, and any interviewer who clicks through from the portfolio itself.

---

## 1. The problem this design solves

A portfolio has a brutal traffic shape. It sits at zero for weeks, then a post lands on LinkedIn or Hacker News and it takes tens of thousands of hits in an hour. The old setup — a single Express process on Render serving both the HTML and the API — fails that shape in three separate ways:

1. **One process, one region.** Every visitor worldwide hit one container. Render's free tier also cold-starts it after inactivity, so the first visitor after a quiet spell waited ~30s for a spinning-up dyno.
2. **Every page view hit GitHub.** The 10-minute in-memory cache died with the process on every restart and every deploy.
3. **The static files were dynamic.** HTML, CSS, JS and a 100 KB JPEG were all served by Node, burning CPU on work a CDN does for free.

The rebuild removes the origin from the hot path entirely.

---

## 2. High-level design

```
                    ┌──────────────────────────────────┐
   visitor ────────▶│   Vercel Edge CDN (global PoPs)  │
                    └──────────────────────────────────┘
                       │                          │
          static, ~100% of requests       /api/*, cache miss only
                       │                          │
                       ▼                          ▼
             ┌──────────────────┐      ┌─────────────────────┐
             │ public/          │      │ serverless function │
             │  index.html      │      │  github-stats.js    │
             │  styles.css      │      │  contact.js         │
             │  script.js       │      └─────────────────────┘
             │  profile.jpeg    │                 │
             │  resume.pdf      │                 ▼
             └──────────────────┘      ┌─────────────────────┐
                                       │ api.github.com      │
                                       │ SMTP                │
                                       └─────────────────────┘
```

**The load-bearing claim:** the number of requests that reach any compute at all is bounded by *time*, not by *visitors*.

- Static files never reach compute. They are served from the PoP nearest the visitor.
- `/api/github-stats` carries `s-maxage=600`, so each CDN region forwards **at most one request per 10 minutes** regardless of whether 10 or 10 million people load the page in that window.
- `stale-while-revalidate=86400` means the revalidation happens *behind* a response that has already been sent. No visitor ever waits on GitHub.

One million page views in an hour costs roughly `6 revalidations × number of active regions` upstream calls — on the order of a hundred, not a million.

---

## 3. Low-level design

### 3.1 The four cache layers

`api/github-stats.js` is defended in depth. Each layer catches what the one above it missed.

| # | Layer | Where | Catches |
|---|-------|-------|---------|
| 1 | CDN (`s-maxage` + SWR) | Vercel edge | Essentially all traffic |
| 2 | `TTLCache` | Function instance memory | Repeat hits on a warm instance |
| 3 | `singleFlight` | Function instance memory | Concurrent misses (stampede) |
| 4 | `lastGood` | Function instance memory | Upstream outage |

### 3.2 Data structures, and why each one

**`TTLCache` — bounded LRU with per-entry expiry** (`api/_lib/cache.js`)

Built on a `Map`, which iterates in insertion order. That single property gives LRU for free: deleting and re-inserting a key on read moves it to the newest position, so the least-recently-used key is always `map.keys().next()`. Get and set are both O(1).

The bound matters more than the speed. An unbounded cache keyed by user input is a memory-exhaustion vector — an attacker requests `?user=a`, `?user=b`, … until the instance dies. Capping at `max` entries makes that attack evict the attacker's own entries instead of the heap.

**`singleFlight` — request coalescing**

The classic cache-stampede failure: a cached entry expires, 500 requests arrive in the same instant, all 500 miss, all 500 call GitHub, GitHub rate-limits the token, and the endpoint is down for an hour. Single-flight makes the first caller do the work and every concurrent caller `await` that same promise. Upstream sees exactly one request no matter how many arrive.

**Token bucket — rate limiting** (`api/_lib/ratelimit.js`)

Chosen over a fixed window because a fixed window permits 2× the quota across a boundary: 8 requests at 14:59 and 8 more at 15:00. A token bucket refills continuously, so it enforces a genuine average rate while still allowing a legitimate short burst. It needs two numbers per caller (`tokens`, `last`) rather than a list of timestamps, and the buckets themselves live in a `TTLCache` so the tracking table is bounded too.

**Honest limitation:** the bucket is per-instance. Vercel may run several instances concurrently, so the real ceiling is `instances × capacity`. That is fine for spam control on a contact form. If this ever guards something that must be exact, move the bucket to Redis — the function signature does not change, only where the two numbers are stored.

### 3.3 Frontend runtime

`public/script.js` holds to a stated performance contract:

- **One scroll listener for the whole page.** Multiple `scroll` handlers each doing their own DOM work is the standard cause of janky scrolling. Here every producer registers a callback and a single `requestAnimationFrame` runs them all, at most once per frame.
- **No forced layout in the scroll path.** Reading `scrollHeight` inside a scroll handler forces a synchronous layout on every tick. It is read once at boot and on a debounced resize.
- **Event delegation for hover.** Two document-level listeners instead of one per interactive element.
- **`DocumentFragment` for bulk DOM.** The contribution graph is 371 cells; built detached and attached once, that is one reflow instead of 371.
- **Idle initialisation.** The particle simulation starts in `requestIdleCallback`, so it never competes with first paint.
- **Self-suspending animation.** The particle loop stops when the hero scrolls out of view or the tab is hidden, via `IntersectionObserver` and `visibilitychange` — no CPU burned animating pixels nobody is looking at.
- **`content-visibility: auto` was tried and removed.** It makes the browser lay out a section from `contain-intrinsic-size` rather than its real height, so an anchor jump to `#contact` scrolled to an estimated offset and then lurched once the true height resolved. Correct framing beat the marginal paint saving on a three-section page.

### 3.4 Section framing

Every section is `min-height: 100dvh` and carries its own background, so arriving from the nav always lands on a composed view rather than mid-content. `dvh` rather than `vh` because a phone's collapsing address bar otherwise leaves a strip of the next section showing.

The giant section word is `position: sticky; top: 0`, full-bleed on the section background. Content scrolls beneath an opaque band instead of colliding with the letterforms — the behaviour in the reference, where the same wordmark sits at the same position across three different scroll states.

Display type is sized `min(width term, height term)`:

```css
font-size: clamp(44px, min(calc(var(--content-w) * var(--display-scale)), 23vh), 250px);
```

The width term holds the reference proportion (14.5% of the content column). The height term stops a 1366×768 laptop being handed type scaled for a 1080p screen. Whichever is smaller wins, so it fits **both** axes. Vertical rhythm follows the same rule — `clamp(min, min(Xvw, Yvh), max)` — so spacing compresses on short screens instead of pushing content out of frame.

### 3.5 Progressive enhancement

The reveal-on-scroll animation hides elements at `opacity: 0` until `IntersectionObserver` fires. If JS fails, is blocked, or the observer never runs, that would leave the page permanently blank below the fold.

So the rule is scoped to `html.js`, a class added by the head script. No JS, no hiding — the content is simply there. The animation is an enhancement; the content is not.

The same head script restores the saved theme before first paint, so dark-mode visitors never see a white flash.

### 3.6 Security

`vercel.json` ships a real Content-Security-Policy, not a permissive one. `script-src` is `'self'` plus a **SHA-256 hash of the one inline script** — no `'unsafe-inline'` anywhere. That required two deliberate choices in the markup:

- No inline event handlers. The font-loading `onload="this.media='all'"` trick was replaced by a `DOMContentLoaded` listener inside the hashed script.
- No inline `style` attributes. The icon sprite's `style="position:absolute"` became a class.

> **If you edit the inline `<script>` in `index.html`, the CSP hash must be regenerated or the page will break.** See the README for the one-liner.

---

## 4. Why Vercel and not Netlify

Both host static files on a good CDN. The deciding factor was the caching behaviour of *function* responses:

- Vercel's edge honours `s-maxage` and `stale-while-revalidate` on serverless responses on the free tier. That is the single mechanism that decouples GitHub API load from visitor count. Without it, `/api/github-stats` is called once per visitor.
- Zero-config `api/` directory — no adapter, no build step, no bundler config.
- Automatic Brotli, HTTP/2, and CDN purge on every deploy, which is what makes long `s-maxage` on unhashed `styles.css` safe.

Netlify can reach the same place with `netlify.toml` and Netlify Functions, but its function-response caching on the free tier is more restricted, which undercuts the main lever.

---

## 5. Failure modes and what happens

| Failure | Behaviour |
|---|---|
| GitHub API down | Last-good snapshot served with `stale: true`; the UI says so |
| GitHub down, no snapshot yet | 502, cached for only 30s so the failure isn't pinned in the CDN for 10 minutes |
| `GITHUB_TOKEN` missing or expired | 503 from the server; the client falls back to GitHub's **public** search API, which needs no token and still returns real PR counts |
| Function cold start | Static page is already painted — the stats are progressive, not blocking |
| JS blocked entirely | Full page renders, all content visible, all links work |
| Contact endpoint flooded | Token bucket returns 429 with `Retry-After`; the form surfaces it as a readable message |
| Mailbox misconfigured | 503 with the server's own reason, shown in the form rather than a generic failure |

Every one of these degrades to something readable. None of them produce a blank page.

---

## 6. Deliberate non-goals

- **No build step.** No bundler, no framework, no `node_modules` in the deploy artifact for the frontend. For a three-section page this is faster to load and far easier to maintain than any framework would be. The cost is unhashed asset filenames, handled by Vercel's deploy-time CDN purge.
- **No analytics or third-party scripts.** Every one would be a CSP exception and a render-blocking request.
- **No third-party form service.** The contact form posts to `/api/contact` and goes out over SMTP from the deployment itself — no Formspree, no Typeform, nothing that would put a visitor's message on someone else's server or need a CSP exception.
