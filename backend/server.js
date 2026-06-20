require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const fetch = require("node-fetch");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(express.json({ limit: "20kb" }));
app.use(cors({ origin: ALLOWED_ORIGIN }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------------------------------------------
// Rate limiting — protects /api/contact from spam/abuse
// ------------------------------------------------------------------
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages sent. Please try again later." }
});

// ------------------------------------------------------------------
// POST /api/contact — validates input and emails it via SMTP
// ------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/contact", contactLimiter, async (req, res) => {
  try {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email and message are required." });
    }
    if (typeof name !== "string" || name.length > 120) {
      return res.status(400).json({ error: "Invalid name." });
    }
    if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 200) {
      return res.status(400).json({ error: "Invalid email address." });
    }
    if (typeof message !== "string" || message.length < 5 || message.length > 4000) {
      return res.status(400).json({ error: "Message must be between 5 and 4000 characters." });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO,
      replyTo: email,
      subject: `New portfolio message from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `
        <p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      `
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Contact form error:", err.message);
    res.status(500).json({ error: "Something went wrong sending your message. Please try again later." });
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ------------------------------------------------------------------
// GET /api/github-stats — real PR counts + contribution calendar
// via GitHub's GraphQL API, using a server-side token. Cached for
// 10 minutes in memory to stay well within rate limits.
// ------------------------------------------------------------------
let ghCache = { data: null, expires: 0 };
const GH_CACHE_TTL_MS = 10 * 60 * 1000;

const GH_QUERY = `
query ($login: String!) {
  user(login: $login) {
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC) {
      totalCount
      nodes { stargazerCount }
    }
    pullRequests(first: 1) { totalCount }
    contributionsCollection {
      pullRequestContributionsByRepository(maxRepositories: 50) {
        contributions(first: 1) { totalCount }
      }
      contributionCalendar {
        weeks {
          contributionDays { contributionCount weekday }
        }
      }
    }
  }
}`;

app.get("/api/github-stats", async (req, res) => {
  const login = (req.query.user || "").toString();
  if (!login) return res.status(400).json({ error: "Missing ?user=" });

  if (ghCache.data && ghCache.expires > Date.now()) {
    return res.json(ghCache.data);
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(503).json({ error: "GITHUB_TOKEN not configured on server." });
  }

  try {
    const ghRes = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `bearer ${process.env.GITHUB_TOKEN}`
      },
      body: JSON.stringify({ query: GH_QUERY, variables: { login } })
    });
    const json = await ghRes.json();
    if (json.errors) throw new Error(json.errors.map(e => e.message).join("; "));

    const user = json.data.user;
    const repos = user.repositories;
    const stars = repos.nodes.reduce((s, r) => s + r.stargazerCount, 0);

    // GitHub's public GraphQL schema doesn't split merged/open/closed PR
    // counts without per-repo search queries; we approximate using the
    // search API for accurate merged/open/closed totals below.
    const prBreakdown = await fetchPRBreakdown(login);

    const weeks = user.contributionsCollection.contributionCalendar.weeks.map(w =>
      w.contributionDays.map(d => contributionLevel(d.contributionCount))
    );

    const payload = {
      repos: repos.totalCount,
      stars,
      merged: prBreakdown.merged,
      open: prBreakdown.open,
      closed: prBreakdown.closed,
      calendar: weeks
    };

    ghCache = { data: payload, expires: Date.now() + GH_CACHE_TTL_MS };
    res.json(payload);
  } catch (err) {
    console.error("GitHub stats error:", err.message);
    res.status(502).json({ error: "Failed to fetch GitHub stats." });
  }
});

async function fetchPRBreakdown(login) {
  const headers = {
    Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json"
  };
  const search = async q => {
    const r = await fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=1`,
      { headers }
    );
    const j = await r.json();
    return j.total_count || 0;
  };
  const [merged, open, closed] = await Promise.all([
    search(`author:${login} type:pr is:merged`),
    search(`author:${login} type:pr is:open`),
    search(`author:${login} type:pr is:closed is:unmerged`)
  ]);
  return { merged, open, closed };
}

function contributionLevel(count) {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Portfolio backend running on port ${PORT}`));
