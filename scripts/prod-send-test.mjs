#!/usr/bin/env node
/**
 * Production SMS test — sender 0717348043 → recipient (default 0713558761).
 *
 *   SMS_TEST_API_KEY=sms_live_... node scripts/prod-send-test.mjs
 */
import "dotenv/config";

const base = process.env.SERVER_URL || "https://chat-easy-integrate.onrender.com";
const apiKey = process.env.SMS_TEST_API_KEY;
const to = process.argv[2] || "254713558761";

if (!apiKey) {
  console.error("Set SMS_TEST_API_KEY (tenant API key for +254717348043)");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
};

console.log("Production:", base);
console.log("To:", to);

const accRes = await fetch(`${base}/api/v1/account`, { headers });
const acc = await accRes.json();
console.log("\nAccount:", accRes.status, {
  canSend: acc.canSend,
  originatingPhone: acc.originatingPhone,
  smppGatewayConfigured: acc.smppGatewayConfigured,
  note: acc.note,
});

const sendRes = await fetch(`${base}/api/v1/sms/send`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    to,
    body: "Production test: From line must show 0717348043.",
  }),
});
const send = await sendRes.json();
console.log("\nSend:", sendRes.status, send);

if (!sendRes.ok) process.exit(1);
console.log("\nCheck handset — sender must be 0717348043, not 0713558761.");
