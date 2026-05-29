#!/usr/bin/env node
/**
 * Create an SMS reseller client and print their API key (for onboarding).
 * Usage: node scripts/create-sms-client.mjs "Imara Logic" tech@imaralogic.co.ke
 */
import "dotenv/config";
import { initDatabase, createSmsResellerClient } from "../server/database.js";

const [providerName, contactEmail] = process.argv.slice(2);
if (!providerName) {
  console.error('Usage: node scripts/create-sms-client.mjs "Company Name" [email]');
  process.exit(1);
}

await initDatabase();
const client = await createSmsResellerClient({
  providerName,
  contactEmail: contactEmail || null,
  sellRateKes: Number(process.env.SMS_SELL_RATE_KES) || 0.3,
  status: "active",
  notes: "Created via create-sms-client script",
});

console.log("\n✅ Client created\n");
console.log("Provider:", client.providerName);
console.log("Client ID:", client.id);
console.log("API Key (share once with client):", client.apiKey);
console.log("\nTest command:\n");
console.log(
  `curl -X POST "${process.env.SERVER_URL || "http://localhost:3000"}/api/v1/sms/send" \\\n` +
    `  -H "Content-Type: application/json" \\\n` +
    `  -H "Authorization: Bearer ${client.apiKey}" \\\n` +
    `  -d '{"to":"254713558761","body":"Imara Logic API integration test"}'`
);
