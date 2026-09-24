/* ============================================================
   GET /api/github-stats?user=<login>

   Read-only, identical for every visitor — so almost none of this
   traffic should ever reach the function at all.

   Four layers, cheapest first:
     1. CDN            s-maxage=600 + stale-while-revalidate=86400
                       -> ~1 origin hit per 10 min per region,
                          independent of visitor count
     2. TTLCache       warm-instance memo, skips the upstream call
     3. singleFlight   concurrent misses collapse into one call
     4. lastGood       upstream failure serves the last snapshot

   Worst case at a million page views: GitHub sees a few hundred
   requests a day, because layer 1 already answered the rest.
============================================================ */

"use strict";

const { TTLCache, singleFlight, lastGood } = require("./_lib/cache");

const TTL_MS = 10 * 60 * 1000;
const memo = new TTLCache(32, TTL_MS);

const GQL = `
query ($login: String!) {
  user(login: $login) {
    repositories(ownerAffiliations: OWNER, privacy: PUBLIC) { totalCount }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          firstDay
          contributionDays { contributionCount weekday }
        }
      }
    }
  }
}`;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function level(count) {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 7) return 3;
  return 4;
}

async function ghSearch(query, token) {
  const url =
    "https://api.github.com/search/issues?per_page=1&q=" + encodeURIComponent(query);
  const r = await fetch(url, {
    headers: {
      Authorization: "bearer " + token,
      Accept: "application/vnd.github+json",
      "User-Agent": "tahleel-portfolio"
    }
  });
  if (!r.ok) throw new Error("search " + r.status);
  const j = await r.json();
  return j.total_count || 0;
}

async function build(login, token) {
  const gqlReq = fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "bearer " + token,
      "User-Agent": "tahleel-portfolio"
    },
    body: JSON.stringify({ query: GQL, variables: { login } })
  }).then(async (r) => {
    const j = await r.json();
    if (j.errors) throw new Error(j.errors.map((e) => e.message).join("; "));
    if (!j.data || !j.data.user) throw new Error("user not found");
    return j.data.user;
  });

  // All four upstream calls run concurrently, so the function's
  // wall-clock cost is one round trip rather than four.
  const [user, merged, open, closed] = await Promise.all([
    gqlReq,
    ghSearch(`author:${login} type:pr is:merged`, token),
    ghSearch(`author:${login} type:pr is:open`, token),
    ghSearch(`author:${login} type:pr is:closed is:unmerged`, token)
  ]);

  const cal = user.contributionsCollection.contributionCalendar;

  const weeks = [];
  const months = [];
  let prevMonth = -1;

  cal.weeks.forEach((w, i) => {
    const days = new Array(7).fill(0);
    w.contributionDays.forEach((d) => { days[d.weekday] = level(d.contributionCount); });
    weeks.push(days);

    // Label a column only where a new month begins, and skip a
    // first column that would be a stub of the previous month.
    const m = new Date(w.firstDay + "T00:00:00Z").getUTCMonth();
    if (m !== prevMonth && i > 0) {
      months.push(MONTHS[m]);
      prevMonth = m;
    } else {
      months.push("");
      if (i === 0) prevMonth = m;
    }
  });

  return {
    repos: user.repositories.totalCount,
    merged,
    open,
    closed,
    totalContributions: cal.totalContributions,
    weeks,
    months,
    generatedAt: new Date().toISOString()
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const login = String((req.query && req.query.user) || "").trim();
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) {
    return res.status(400).json({ error: "Invalid ?user=" });
  }

  const token = process.env.GITHUB_TOKEN;

  // Layer 1 — let the CDN answer for everyone else.
  res.setHeader(
    "Cache-Control",
    "public, max-age=0, s-maxage=600, stale-while-revalidate=86400"
  );

  if (!token) {
    return res.status(503).json({ error: "GITHUB_TOKEN is not configured." });
  }

  // Layer 2 — warm-instance memo.
  const cached = memo.get(login);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cached);
  }

  try {
    // Layer 3 — collapse concurrent misses into one upstream call.
    const data = await singleFlight("gh:" + login, () => build(login, token));
    memo.set(login, data);
    lastGood.set(login, data);
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);
  } catch (err) {
    console.error("github-stats:", err.message);

    // Layer 4 — stale beats broken.
    const stale = lastGood.get(login);
    if (stale) {
      res.setHeader("X-Cache", "STALE");
      return res.status(200).json(Object.assign({}, stale, { stale: true }));
    }

    // Don't let a transient upstream failure get cached for 10 min.
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30");
    return res.status(502).json({ error: "Upstream GitHub request failed." });
  }
};
