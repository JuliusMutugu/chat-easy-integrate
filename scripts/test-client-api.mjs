#!/usr/bin/env node
/**
 * Test client API with an API key.
 * Usage: SMS_TEST_API_KEY=sms_live_... node scripts/test-client-api.mjs [phone]
 */
import "dotenv/config";

const apiKey = process.env.SMS_TEST_API_KEY;
const base = process.env.SERVER_URL || "http://localhost:3000";
const phone = process.argv[2] || "254713558761";

if (!apiKey) {
  console.error("Set SMS_TEST_API_KEY to the client's API key");
  process.exit(1);
}

console.log("Base URL:", base);
console.log("Account check...");
const acc = await fetch(`${base}/api/v1/account`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});
console.log("GET /api/v1/account", acc.status, await acc.json());

console.log("\nSending test SMS to", phone, "...");
const send = await fetch(`${base}/api/v1/sms/send`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    to: phone,
    body: "Client API integration test – please confirm receipt.",
  }),
});
const body = await send.json();
console.log("POST /api/v1/sms/send", send.status, body);
process.exit(send.ok ? 0 : 1);
