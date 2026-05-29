#!/usr/bin/env node
/**
 * Register a tenant's own Traccar gateway (their phone/SIM).
 * Usage:
 *   node scripts/set-tenant-gateway.mjs <clientId> <gatewayUrl> <gatewayApiKey> <originatorPhone>
 * Example:
 *   node scripts/set-tenant-gateway.mjs src-xxx http://192.168.100.10:8082 token +254713558761
 */
import "dotenv/config";
import { initDatabase, updateSmsResellerClientGateway } from "../server/database.js";
import { normalizePhoneNumber } from "../server/services/traccarSmsGateway.js";

const [clientId, gatewayUrl, gatewayApiKey, originatorPhoneRaw] = process.argv.slice(2);
if (!clientId || !gatewayUrl || !gatewayApiKey || !originatorPhoneRaw) {
  console.error(
    "Usage: node scripts/set-tenant-gateway.mjs <clientId> <gatewayUrl> <gatewayApiKey> <+254...>"
  );
  process.exit(1);
}

const originatorPhone = normalizePhoneNumber(originatorPhoneRaw);

await initDatabase();
const client = await updateSmsResellerClientGateway(clientId, {
  gatewayUrl,
  gatewayApiKey,
  gatewayProvider: "traccar",
  gatewayMethod: "POST",
  originatorPhone,
});

if (!client) {
  console.error("Client not found:", clientId);
  process.exit(1);
}

console.log("✅ Tenant gateway configured");
console.log("Client:", client.providerName);
console.log("Originating phone:", client.originatorPhone);
console.log("Gateway URL:", client.gatewayUrl);
console.log("\nRecipients see", client.originatorPhone, "— not the platform owner's number.");
