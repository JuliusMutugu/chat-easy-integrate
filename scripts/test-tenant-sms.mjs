#!/usr/bin/env node
/**
 * Test tenant isolation: client API must use tenant gateway, not platform .env.
 * Usage:
 *   SMS_TEST_API_KEY=... SERVER_URL=http://localhost:3001 node scripts/test-tenant-sms.mjs 0713558761
 */
import "dotenv/config";

const apiKey = process.env.SMS_TEST_API_KEY;
const base = process.env.SERVER_URL || "http://localhost:3001";
const phone = process.argv[2] || "0713558761";

if (!apiKey) {
  console.error("Set SMS_TEST_API_KEY");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
};

console.log("1) Account (expect deliveryMode: managed or dedicated)...");
const accRes = await fetch(`${base}/api/v1/account`, { headers });
const acc = await accRes.json();
console.log(accRes.status, acc);

if (!acc.deliveryMode) {
  console.error("\n❌ Unexpected account response");
  process.exit(1);
}

console.log("\n2) Send via tenant route...");
const sendRes = await fetch(`${base}/api/v1/sms/send`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    to: phone,
    body: "Tenant isolation test – sent from YOUR registered gateway/SIM, not platform default.",
  }),
});
const send = await sendRes.json();
console.log(sendRes.status, send);

if (!sendRes.ok) {
  process.exit(1);
}

if (send.route !== "managed" && send.route !== "dedicated") {
  console.error("❌ Expected route=managed or dedicated, got", send.route);
  process.exit(1);
}

console.log("\n✅ Customer SMS OK — route:", send.route, send.gatewayUrl ? `gateway ${send.gatewayUrl}` : "");
