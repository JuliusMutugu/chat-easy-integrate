#!/usr/bin/env node
/**
 * End-to-end SMS test: client API → platform → Traccar phone → recipient.
 *
 * Usage:
 *   SMS_TEST_API_KEY=sms_live_... SERVER_URL=http://localhost:3001 \
 *     node scripts/test-e2e-sms.mjs 254746828741
 */
import "dotenv/config";

const apiKey = process.env.SMS_TEST_API_KEY;
const base = process.env.SERVER_URL || "http://localhost:3001";
const phone = process.argv[2] || "254746828741";

if (!apiKey) {
  console.error("Set SMS_TEST_API_KEY (Imara Logic client API key)");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
};

console.log("=== E2E SMS test ===\n");
console.log("API:", base);
console.log("To: ", phone);

console.log("\n[1/3] Account + brand...");
const accRes = await fetch(`${base}/api/v1/account`, { headers });
const acc = await accRes.json();
if (!accRes.ok) {
  console.error("FAIL", accRes.status, acc);
  process.exit(1);
}
console.log("  brandSenderName:     ", acc.brandSenderName);
console.log("  registeredSenderId:  ", acc.registeredSenderId);
console.log("  fromLineBehavior:    ", acc.fromLineBehavior);
console.log("  shared From line?:   ", acc.senderIdSharedWithOtherTenants);
console.log("  aggregatorConfigured:", acc.aggregatorConfigured);
console.log("  deliveryMode:        ", acc.deliveryMode);
if (acc.note) console.log("  note:", acc.note);

if (acc.brandSenderName !== "ImaraLogicSystems") {
  console.warn("  ⚠ Expected brandSenderName ImaraLogicSystems — run:");
  console.warn('    node scripts/set-tenant-sender.mjs --name "Imara Logic" ImaraLogicSystems');
}

const body =
  "E2E test: your SMS API is live. Reply OK if you see ImaraLogicSystems in the message.";

console.log("\n[2/3] Send via POST /api/v1/sms/send...");
const sendRes = await fetch(`${base}/api/v1/sms/send`, {
  method: "POST",
  headers,
  body: JSON.stringify({ to: phone, body }),
});
const send = await sendRes.json();
console.log("  status:", sendRes.status);
console.log("  route:", send.route);
console.log("  brandSenderName:", send.brandSenderName);
console.log("  messagePreview:", send.messagePreview);

if (!sendRes.ok) {
  console.error("\n❌ Send failed:", send.error || send);
  process.exit(1);
}

console.log("\n[3/3] Check your phone");
console.log("  Expected SMS starts with: [ImaraLogicSystems]");
console.log("  Full text preview:", send.messagePreview || `[ImaraLogicSystems] ${body}`);

if (send.messagePreview && !send.messagePreview.includes("[ImaraLogicSystems]")) {
  console.warn("\n  ⚠ Brand prefix missing — set SMS_BRAND_PREFIX=1 in server .env");
}

console.log("\n✅ E2E request completed — confirm SMS on device", phone);
