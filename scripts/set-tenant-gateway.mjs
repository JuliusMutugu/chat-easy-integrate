#!/usr/bin/env node
/**
 * Register a tenant's own Traccar gateway (their phone/SIM).
 * Usage:
 *   node scripts/set-tenant-gateway.mjs <clientId> <gatewayUrl> <gatewayApiKey>
 * Example:
 *   node scripts/set-tenant-gateway.mjs src-xxx http://192.168.100.10:8082 their-traccar-token
 */
import "dotenv/config";
import { initDatabase, updateSmsResellerClientGateway, getSmsResellerClientById } from "../server/database.js";

const [clientId, gatewayUrl, gatewayApiKey] = process.argv.slice(2);
if (!clientId || !gatewayUrl || !gatewayApiKey) {
  console.error(
    "Usage: node scripts/set-tenant-gateway.mjs <clientId> <gatewayUrl> <gatewayApiKey>"
  );
  process.exit(1);
}

await initDatabase();
const client = await updateSmsResellerClientGateway(clientId, {
  gatewayUrl,
  gatewayApiKey,
  gatewayProvider: "traccar",
  gatewayMethod: "POST",
});

if (!client) {
  console.error("Client not found:", clientId);
  process.exit(1);
}

console.log("✅ Tenant gateway configured");
console.log("Client:", client.providerName);
console.log("Gateway URL:", client.gatewayUrl);
console.log("Gateway token preview:", client.gatewayApiKeyPreview);
console.log("\nSMS from this tenant's API key will use ONLY this gateway (their SIM).");
