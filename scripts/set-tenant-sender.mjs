#!/usr/bin/env node
/**
 * Set per-tenant sender IDs for SaaS (each customer gets their own registered ID).
 *
 * Usage:
 *   node scripts/set-tenant-sender.mjs --name "Imara Logic" --registered ImaraLogic --brand ImaraLogicSystems
 *   node scripts/set-tenant-sender.mjs src-xxx --registered ACMEAlerts --brand ACMEAlerts
 */
import "dotenv/config";
import {
  initDatabase,
  getSmsResellerClientById,
  listSmsResellerClients,
  updateSmsResellerClientSender,
} from "../server/database.js";
import { resolveTenantSender } from "../server/services/senderId.js";

const args = process.argv.slice(2);
let clientId = null;
let providerName = null;
let registered = null;
let brand = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--name" && args[i + 1]) providerName = args[++i];
  else if ((args[i] === "--registered" || args[i] === "--sender") && args[i + 1]) {
    registered = args[++i];
  } else if ((args[i] === "--brand" || args[i] === "--brand-name") && args[i + 1]) {
    brand = args[++i];
  } else if (args[i].startsWith("src-")) clientId = args[i];
  else if (!registered) registered = args[i];
}

if (!registered) {
  console.error(
    "Usage: node scripts/set-tenant-sender.mjs --name \"Company\" --registered ImaraLogic [--brand ImaraLogicSystems]\n" +
      "       (registered = unique MNO sender ID, max 11 chars, one per SaaS customer)"
  );
  process.exit(1);
}

await initDatabase();

let client = null;
if (clientId) {
  client = await getSmsResellerClientById(clientId);
} else if (providerName) {
  const all = await listSmsResellerClients();
  client = all.find((c) => c.providerName === providerName) || null;
}

if (!client) {
  console.error("Client not found.");
  process.exit(1);
}

const sender = resolveTenantSender({
  senderId: registered,
  brandSenderName: brand || registered,
  providerName: client.providerName,
});

const updated = await updateSmsResellerClientSender(client.id, {
  senderId: sender.registeredSenderId,
  brandSenderName: sender.brandSenderName,
});

console.log("\n✅ Per-tenant sender updated\n");
console.log("Client:              ", updated.providerName, `(${updated.id})`);
console.log("Registered sender ID:", sender.registeredSenderId, "(unique From line when using SMS_AGGREGATOR_URL)");
console.log("Brand name:          ", sender.brandSenderName, "(message prefix on shared phone gateway)");
if (sender.senderIdNote) console.log("Note:                ", sender.senderIdNote);
