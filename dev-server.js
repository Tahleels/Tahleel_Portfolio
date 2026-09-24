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

app.listen(PORT, () => {
  console.log(`\n  Portfolio dev server → http://localhost:${PORT}\n`);
});
