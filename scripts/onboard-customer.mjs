#!/usr/bin/env node
/**
 * Onboard tenant — customer only needs API key + their phone number.
 * YOU host the SMS gateway on your server (SMPP). No Traccar on their phone.
 *
 * Usage:
 *   node scripts/onboard-customer.mjs "Acme Ltd" billing@acme.com --phone 254717348043
 */
import "dotenv/config";
import {
  initDatabase,
  createSmsResellerClient,
  getSmsResellerClientById,
} from "../server/database.js";
import { normalizePhoneNumber } from "../server/services/traccarSmsGateway.js";

const args = process.argv.slice(2);
const providerName = args[0];
const contactEmail = args[1] && !args[1].startsWith("--") ? args[1] : null;

let phone = null;
for (let i = 0; i < args.length; i++) {
  if ((args[i] === "--phone" || args[i] === "--originator") && args[i + 1]) {
    phone = normalizePhoneNumber(args[++i]);
  }
}

if (!providerName || !phone) {
  console.error(
    'Usage: node scripts/onboard-customer.mjs "Company Name" [email] --phone 2547XXXXXXXX\n' +
      "Customer installs nothing. You set SMPP_GATEWAY_URL on your server."
  );
  process.exit(1);
}

await initDatabase();

const client = await createSmsResellerClient({
  providerName,
  contactEmail,
  contactPhone: phone,
  originatorPhone: phone,
  sellRateKes: Number(process.env.SMS_SELL_RATE_KES) || 0.3,
  status: "active",
  notes: "Platform-hosted gateway; customer MSISDN as From address",
});

const final = await getSmsResellerClientById(client.id, { includeFullApiKey: true });

console.log("\n✅ Tenant onboarded (no app on their phone)\n");
console.log("Company:           ", final.providerName);
console.log("Their number (From):", phone);
console.log("Client ID:         ", final.id);
console.log("\n🔑 API KEY (give customer once):\n", final.apiKey);
console.log("\nYour server needs: SMPP_GATEWAY_URL (production)");
console.log("Dev test only:     SMS_DEV_SIMULATE=1 in .env\n");
console.log(
  `SMS_TEST_API_KEY=${final.apiKey} SERVER_URL=http://localhost:3001 node scripts/test-e2e-sms.mjs 0713558761`
);
