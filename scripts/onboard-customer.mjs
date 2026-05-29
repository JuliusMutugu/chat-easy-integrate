#!/usr/bin/env node
/**
 * Onboard a new SMS SaaS customer (unique registered sender ID per tenant).
 *
 * Usage:
 *   node scripts/onboard-customer.mjs "Imara Logic" tech@imaralogic.co.ke \
 *     --registered ImaraLogic --brand ImaraLogicSystems
 *
 * Optional dedicated phone:
 *   ... --gateway http://192.168.100.10:8082 --token THEIR_TRACCAR_TOKEN
 */
import "dotenv/config";
import {
  initDatabase,
  createSmsResellerClient,
  updateSmsResellerClientGateway,
} from "../server/database.js";
import { resolveTenantSender } from "../server/services/senderId.js";

const args = process.argv.slice(2);
const providerName = args[0];
const contactEmail = args[1] && !args[1].startsWith("--") ? args[1] : null;

let gatewayUrl = null;
let gatewayToken = null;
let registered = null;
let brand = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--gateway" && args[i + 1]) gatewayUrl = args[++i];
  if (args[i] === "--token" && args[i + 1]) gatewayToken = args[++i];
  if ((args[i] === "--registered" || args[i] === "--sender") && args[i + 1]) {
    registered = args[++i];
  }
  if ((args[i] === "--brand" || args[i] === "--brand-name") && args[i + 1]) {
    brand = args[++i];
  }
}

if (!providerName || !registered) {
  console.error(
    'Usage: node scripts/onboard-customer.mjs "Company" [email] --registered SenderID [--brand LongBrandName]'
  );
  process.exit(1);
}

await initDatabase();

const sender = resolveTenantSender({
  senderId: registered,
  brandSenderName: brand || registered,
  providerName,
});

if (!sender.registeredSenderId) {
  console.error("Invalid --registered (max 11 characters after normalization)");
  process.exit(1);
}

const client = await createSmsResellerClient({
  providerName,
  contactEmail,
  sellRateKes: Number(process.env.SMS_SELL_RATE_KES) || 0.3,
  status: "active",
  notes: "Onboarded via onboard-customer script",
  senderId: sender.registeredSenderId,
  brandSenderName: sender.brandSenderName,
});

let final = client;
if (gatewayUrl && gatewayToken) {
  final = await updateSmsResellerClientGateway(client.id, {
    gatewayUrl,
    gatewayApiKey: gatewayToken,
  });
}

const base = process.env.SERVER_URL || "http://localhost:3000";
const mode = final.gatewayConfigured ? "dedicated" : "managed";

console.log("\n✅ Customer onboarded (SaaS sender)\n");
console.log("Company:              ", final.providerName);
console.log("Client ID:            ", final.id);
console.log("Registered sender ID: ", sender.registeredSenderId);
console.log("Brand:                ", sender.brandSenderName);
console.log("Delivery:             ", mode);
console.log(
  "\nFor unique From line (not shared SIM): set SMS_AGGREGATOR_URL on server or assign --gateway per tenant.\n"
);
console.log("🔑 API KEY:\n", final.apiKey);
