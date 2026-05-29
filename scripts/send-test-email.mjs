#!/usr/bin/env node
/**
 * Send a test email using Integrations SMTP config (DB) + .env SMTP_* overrides.
 *
 * Usage:
 *   node scripts/send-test-email.mjs
 *   node scripts/send-test-email.mjs you@example.com
 */
import "dotenv/config";
import { initDatabase, getChannelConfig } from "../server/database.js";
import { sendEmail, validateEmailConfig } from "../server/channels/email.js";

const to = process.argv[2] || "ndegwajulius239@gmail.com";

function stripEnvQuotes(val) {
  if (val == null || typeof val !== "string") return val;
  const s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

async function getEmailConfig() {
  const fromDb = (await getChannelConfig("email"))?.config || {};
  const fromEnv = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM,
  };
  const merged = { ...fromDb };
  for (const [k, v] of Object.entries(fromEnv)) {
    if (v !== undefined && v !== "") {
      if (k === "port") merged[k] = parseInt(v, 10) || merged[k];
      else if (k === "secure") merged[k] = v === "true" || v === "1";
      else merged[k] = stripEnvQuotes(String(v));
    }
  }
  return merged;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>SMS API test</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);">
        <tr><td style="padding:32px 40px;background:linear-gradient(135deg,#0f172a,#1e293b);text-align:center;">
          <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.85);">Imara Logic · SMS</p>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Test email — platform ready</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
            This confirms your SMTP integration is working. You can use the same channel for invite emails and notifications.
          </p>
          <table width="100%" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">SMS reseller</p>
              <p style="margin:0;font-size:14px;color:#0f172a;"><strong>Brand:</strong> ImaraLogicSystems</p>
              <p style="margin:8px 0 0;font-size:14px;color:#0f172a;"><strong>Rate:</strong> KES 0.30 / SMS</p>
              <p style="margin:8px 0 0;font-size:14px;color:#0f172a;"><strong>Delivery:</strong> Managed (provider-hosted gateway)</p>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">Sent from your messaging platform test script.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

await initDatabase();
const config = await getEmailConfig();
const valid = validateEmailConfig(config);
if (!valid.valid) {
  console.error("Email not configured:", valid.error);
  console.error("Set SMTP in Integrations (Email) or add SMTP_* to .env");
  process.exit(1);
}

console.log("Sending test email to:", to);
console.log("SMTP host:", config.host, "| from:", config.from || config.user);

try {
  const result = await sendEmail(config, {
    to,
    subject: "Test — Imara Logic SMS platform (SMTP OK)",
    text:
      "Test email from your messaging platform.\n\n" +
      "SMS brand: ImaraLogicSystems\nRate: KES 0.30/SMS\nDelivery: managed gateway\n\n" +
      "If you received this, SMTP is working.",
    html,
  });
  console.log("\n✅ Email sent");
  console.log("Message ID:", result.messageId);
  console.log("Accepted:  ", result.accepted?.join(", ") || to);
} catch (err) {
  console.error("\n❌ Send failed:", err.message);
  if (/from|sender|550|553/i.test(err.message)) {
    console.error(
      "Tip: Gmail usually requires From to match your SMTP_USER. Update Integrations → Email → From."
    );
  }
  process.exit(1);
}
