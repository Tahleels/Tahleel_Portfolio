/* ============================================================
   POST /api/contact

   Backs the contact form in the Contact section. The page also
   shows the address with a copy button, so a visitor who would
   rather use their own mail client never has to touch the form.

   Protections, cheapest check first so abuse costs the least:
     1. method + payload size
     2. token-bucket rate limit per IP
     3. honeypot field
     4. field validation
     5. SMTP send (the only expensive step)
============================================================ */

"use strict";

const { take, clientIp } = require("./_lib/ratelimit");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 20 * 1024;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_BODY_BYTES) {
    return res.status(413).json({ error: "Payload too large." });
  }

  // 2 — rate limit: burst of 8, refilling to 8 per 15 minutes.
  const gate = take(clientIp(req), 8, 8 / 900);
  if (!gate.allowed) {
    res.setHeader("Retry-After", String(gate.retryAfter));
    return res.status(429).json({ error: "Too many messages. Try again shortly." });
  }
  res.setHeader("X-RateLimit-Remaining", String(gate.remaining));

  const body = req.body || {};
  const { name, email, message, website } = body;

  // 3 — honeypot: a hidden field only a bot fills in. Answer 200 so
  // the bot records success and does not retry with a new strategy.
  if (website) return res.status(200).json({ ok: true });

  // 4 — validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email and message are required." });
  }
  if (typeof name !== "string" || name.length > 120) {
    return res.status(400).json({ error: "Invalid name." });
  }
  if (typeof email !== "string" || email.length > 200 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }
  if (typeof message !== "string" || message.length < 5 || message.length > 4000) {
    return res.status(400).json({ error: "Message must be 5–4000 characters." });
  }

  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "CONTACT_TO"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error("contact: missing env: " + missing.join(", "));
    return res.status(503).json({ error: "Mail transport is not configured." });
  }

  try {
    // 5 — required lazily so a cold start that never sends mail
    // does not pay to load the SMTP client.
    const nodemailer = require("nodemailer");
    const port = Number(process.env.SMTP_PORT || 465);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO,
      replyTo: email,
      subject: `New portfolio message from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html:
        `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>` +
        `<p><strong>Message:</strong></p>` +
        `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("contact:", err.message);
    return res.status(500).json({ error: "Could not send your message. Please email me directly." });
  }
};
