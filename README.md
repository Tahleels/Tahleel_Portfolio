# Tahleel Shaikh — Portfolio

An editorial, brutalist-minimal portfolio for an AI Engineer / Agentic AI Developer. Static frontend (HTML/CSS/JS, no build step) + a small Express backend for the contact form and live GitHub stats.

## Structure

```
portfolio/
├── index.html        ← all sections (Home, About, Experience, Projects, Open Source, Skills, Contact)
├── styles.css         ← design system + responsive layout
├── script.js          ← interactions, data, API calls
└── backend/
    ├── server.js      ← Express API (contact form + GitHub stats)
    ├── package.json
    └── .env.example
```

## 1. Personalize the content

- **Photo**: replace the `.avatar-photo` block in `index.html` with a real `<img>` if you have a headshot.
- **Resume**: drop a `resume.pdf` next to `index.html` (the Download Resume button already links to `/resume.pdf`).
- **Projects / Skills / Certifications**: edit the `PROJECTS`, `SKILLS`, `CERTS` arrays at the top of `script.js`.
- **Links**: update GitHub/LinkedIn/X/email URLs in `index.html` (sidebar + Contact section) and `GITHUB_USERNAME` in `script.js`.

## 2. Run the frontend

It's static — no build step required.

```bash
# from the portfolio/ folder
npx serve .
```

Deploy `index.html`, `styles.css`, `script.js` (and `resume.pdf`) to any static host: Vercel, Netlify, Cloudflare Pages, GitHub Pages.

## 3. Run the backend

The backend does two things a static site can't do safely:

1. **Contact form** — receives submissions and emails you via SMTP (Nodemailer). Keeps your SMTP credentials off the client.
2. **Live GitHub stats** — calls GitHub's GraphQL + Search APIs with a personal access token to get real merged/open/closed PR counts and your contribution calendar. This requires a token, so it must run server-side — a token in frontend JS would be public.

```bash
cd backend
cp .env.example .env   # fill in SMTP + GitHub credentials
npm install
npm start               # runs on http://localhost:4000
```

Deploy the backend to Render, Railway, Fly.io, or any Node host. Then in `script.js`, set:

```js
const API_BASE = "https://your-backend-url.com";
```

(or set `window.PORTFOLIO_API_BASE` before `script.js` loads, e.g. in an inline `<script>` tag, so you don't need to edit the file per-environment).

### Environment variables (`backend/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | Port the API listens on |
| `ALLOWED_ORIGIN` | Your deployed frontend origin, for CORS |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Mailbox used to send contact-form emails (use an app password, not your real password) |
| `CONTACT_TO` | Where contact-form messages land |
| `GITHUB_TOKEN` | Fine-grained PAT, read-only, used to pull real PR/contribution data |

### Endpoints

- `POST /api/contact` — `{ name, email, message }` → sends an email, rate-limited to 8 requests / 15 min per IP.
- `GET /api/github-stats?user=<login>` — returns `{ repos, stars, merged, open, closed, calendar }`, cached 10 minutes server-side.
- `GET /health` — uptime check.

If the backend is unreachable, the frontend gracefully falls back to GitHub's public REST API (repo count + star count only — no PR breakdown, no token needed) so the page never looks broken.

## 4. Design tokens

All colors, type and spacing live as CSS variables at the top of `styles.css` — change the palette or scale globally from one place.

## Notes

- No internal scroll containers — the whole site is one continuously scrollable document, per the brief.
- Reduced-motion users get all transitions/animations disabled automatically (`prefers-reduced-motion`).
- Mobile sidebar collapses into a top profile block; tablet gets a slide-out drawer triggered by the top-right menu button.
