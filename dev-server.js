/* ============================================================
   LOCAL DEV SERVER — not used in production.

   Production is Vercel: public/ is served straight from the CDN
   and api/*.js run as serverless functions. This file exists so
   the same thing can be run on localhost with `npm run dev`.

   The API handlers are NOT reimplemented here. Vercel's handler
   signature (req.method / req.query / req.body, res.status().json())
   is satisfied by Express, so api/github-stats.js and api/contact.js
   are mounted verbatim — one implementation, two runtimes, no
   chance of the local and deployed behaviour drifting apart.
============================================================ */

"use strict";

require("dotenv").config();

const express = require("express");
const path = require("path");

const githubStats = require("./api/github-stats");
const contact = require("./api/contact");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: "20kb" }));

// Express sits behind no proxy locally; trust the loopback address
// so the rate limiter sees a stable key.
app.set("trust proxy", true);

app.get("/api/github-stats", (req, res) => githubStats(req, res));
app.post("/api/contact", (req, res) => contact(req, res));
app.get("/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

app.use(
  express.static(path.join(__dirname, "public"), {
    extensions: ["html"],
    setHeaders(res, filePath) {
      // Mirror the production cache policy from vercel.json so a
      // caching bug shows up locally instead of in production.
      if (/\.(css|js)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=600");
      } else if (/\.(jpeg|jpg|png|svg|webp|ico|woff2)$/.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=604800");
      } else {
        res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
      }
    }
  })
);

/* Environment is read once, at startup, by dotenv. Editing .env while
   the server is running changes nothing until it restarts — which
   looks exactly like "my new token doesn't work". So say out loud
   what this process actually loaded. */
function report() {
  const tick = (ok) => (ok ? "ok  " : "MISSING");
  const gh = !!process.env.GITHUB_TOKEN;
  const smtp = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "CONTACT_TO"]
    .filter((k) => !process.env[k]);

  console.log(`\n  Portfolio dev server → http://localhost:${PORT}\n`);
  console.log(`  [${tick(gh)}] GITHUB_TOKEN   ${gh ? "contribution graph + PR counts live" : "graph will be hidden; PR counts fall back to the public API"}`);
  console.log(`  [${tick(!smtp.length)}] SMTP           ${smtp.length ? "contact form disabled — missing " + smtp.join(", ") : "contact form can send"}`);
  if (process.env.SMTP_HOST && process.env.SMTP_HOST.includes("@")) {
    console.log("  [warn]   SMTP_HOST looks like an email address; it must be a hostname (smtp.gmail.com)");
  }
  console.log("\n  Values are read at startup — restart after editing .env.\n");
}

app.listen(PORT, report);
