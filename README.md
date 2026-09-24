# Tahleel Shaikh — Portfolio

Static frontend served from the Vercel CDN, with two cache-first serverless endpoints. No build step, no framework.

- **Design** — editorial black rail + off-white canvas, gold accent.
- **Architecture** — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the HLD/LLD, the caching layers, and why each data structure was chosen.

```
.
├── public/               ← everything the CDN serves
│   ├── index.html        ← all three sections, static markup (no JS render)
│   ├── styles.css        ← design tokens + measured responsive system
│   ├── script.js         ← animations + GitHub stats
│   ├── profile.jpeg
│   └── TahleelShaikhResume.pdf
├── api/                  ← Vercel serverless functions
│   ├── github-stats.js   ← CDN-cached, single-flighted, stale-on-error
│   ├── contact.js        ← token-bucket limited (currently unused by the UI)
│   └── _lib/
│       ├── cache.js      ← TTLCache (bounded LRU) + singleFlight + lastGood
│       └── ratelimit.js  ← token bucket + client IP resolution
├── dev-server.js         ← local only; mounts the SAME api/ handlers
├── vercel.json           ← cache policy, security headers, CSP
└── docs/ARCHITECTURE.md
```

## Run locally

```bash
npm install
cp .env.example .env     # fill in GITHUB_TOKEN
npm run dev              # http://localhost:4000
```

`dev-server.js` does **not** reimplement the API. Express satisfies the same handler signature Vercel uses (`req.method` / `req.query` / `req.body`, `res.status().json()`), so `api/github-stats.js` and `api/contact.js` are mounted verbatim — one implementation, two runtimes, no drift between local and production.

## Deploy to Vercel

```bash
npm i -g vercel
vercel                   # preview
vercel --prod            # production
```

Or connect the GitHub repo at [vercel.com/new](https://vercel.com/new) — it auto-deploys on push to `main`. `vercel.json` already sets `outputDirectory: public`, so no build settings are needed.

### Environment variables

Set these in **Project Settings → Environment Variables** (never in the repo):

| Variable | Required | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | yes | Fine-grained PAT, **read-only, no scopes**. Powers live PR counts + the contribution calendar. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | **yes** | Mailbox the contact form sends through. `SMTP_HOST` is a hostname (`smtp.gmail.com`), not your address. Gmail: use an App Password with the spaces stripped. |
| `CONTACT_TO` | **yes** | Where contact-form messages land. |

Without `GITHUB_TOKEN` the page still works — the client falls back to GitHub's public search API for PR counts. Only the contribution calendar needs the token.

### Custom domain

Add it under **Project Settings → Domains**, then update the four hardcoded `https://tahleelshaikh.dev/` references in `public/index.html` (canonical, `og:url`, `og:image`, `twitter:image`) and the one in `public/sitemap.xml` and `public/robots.txt`.

## Endpoints

| Endpoint | Cache | Notes |
|---|---|---|
| `GET /api/github-stats?user=<login>` | `s-maxage=600`, SWR 24h | `X-Cache: HIT \| MISS \| STALE` tells you which layer answered |
| `POST /api/contact` | `no-store` | Backs the contact form. 8-request burst, refilling over 15 min, per IP, plus a honeypot field |
| `GET /health` | — | local dev server only |

## Editing content

Everything is static markup — there is no data file to regenerate.

| What | Where |
|---|---|
| Projects | the six `<article class="project-card">` blocks in `index.html` |
| Experience | the two `<div class="exp">` blocks |
| Education / Topmate | the two `<div class="home-col">` blocks |
| Social links | sidebar `.sb-social` **and** contact `.contact-right` |
| Colours, spacing, type | the `:root` token block at the top of `styles.css` |

## ⚠️ If you edit the inline `<script>` in index.html

The CSP whitelists it by hash. Change it and the page stops working until you regenerate:

```bash
node -e "const f=require('fs'),c=require('crypto');const m=f.readFileSync('public/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/);console.log('sha256-'+c.createHash('sha256').update(m[1],'utf8').digest('base64'))"
```

Paste the result into the `Content-Security-Policy` value in `vercel.json`.

## Responsive contract

Breakpoints were measured from reference screenshots, not guessed.

| Width | Behaviour |
|---|---|
| ≥ 1600px | Rail 400px (capped); content wrapper capped at 1500px |
| 1281–1599px | Rail `20.5vw`; gutter `4vw`; display type `14.5%` of content width |
| 1201–1280px | Rail narrows to `clamp(272px, 25vw, 330px)`; display type `15.5%` |
| 901–1200px | Rail still fixed, but project/contact grids drop to one column before the cards squash |
| ≤ 900px | **Rail unpins** into a static stacked block — no drawer, no hamburger. Photo 55% @ 3:2, nav card capped at 260px, gutter 24px |
| ≤ 560px | Stat cards tighten, project padding reduces, buttons go full-width |
| ≤ 380px | Gutter 18px, stat numbers step down |
| **≤ 720px tall** | Short-screen mode: band and rhythm tighten, lede runs wider (fewer lines, same size) so Home still fits a 1366×768 laptop's ~625px real viewport |

Every section is a **frame**: `min-height: 100dvh`, its own background, and a sticky full-bleed wordmark pinned to the top — so clicking home/work/contact always lands on a composed view.

Sizing answers to **both axes**. Display type is `min(14.5% of the content column, 23vh)` and vertical rhythm is `clamp(min, min(Xvw, Yvh), max)`, so a short laptop (1366×768) compresses rather than overflowing. Verified framing on 1366×768, 1440×900, 1536×864, 1920×1080, 1280×800, 1024×768, 820×1180, 430×932, 393×852 and 360×640.

## Accessibility

Skip link, visible focus rings, `prefers-reduced-motion` disables every animation, all icon-only controls carry `aria-label`, contribution graph is `role="img"` with a label, and the page is fully readable with JavaScript disabled.
