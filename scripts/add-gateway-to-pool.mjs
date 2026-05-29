#!/usr/bin/env node
/**
 * Append a Traccar gateway entry and print what to put in .env (SMS_GATEWAY_POOL).
 *
 * Usage:
 *   node scripts/add-gateway-to-pool.mjs http://192.168.1.50:8082 YOUR_TOKEN
 *   node scripts/add-gateway-to-pool.mjs http://192.168.1.51:8082 TOKEN --id sim2
 */
import "dotenv/config";

function stripEnvQuotes(val) {
  if (val == null || typeof val !== "string") return val;
  const s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseGatewayPool() {
  const raw = process.env.SMS_GATEWAY_POOL;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(stripEnvQuotes(String(raw)));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const args = process.argv.slice(2);
let gatewayUrl = null;
let apiKey = null;
let id = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--id" && args[i + 1]) {
    id = args[++i];
  } else if (!gatewayUrl && args[i].startsWith("http")) {
    gatewayUrl = args[i].replace(/\/$/, "");
  } else if (gatewayUrl && !apiKey && !args[i].startsWith("--")) {
    apiKey = args[i];
  }
}

if (!gatewayUrl || !apiKey) {
  console.error(
    "Usage: node scripts/add-gateway-to-pool.mjs http://PHONE_IP:8082 TRACCAR_TOKEN [--id sim1]"
  );
  process.exit(1);
}

const existing = parseGatewayPool();
const entryId = id || `sim${existing.length + 1}`;
const entry = { id: entryId, url: gatewayUrl, key: apiKey };
const next = [...existing, entry];

console.log("\n── Add to .env ──\n");
console.log("# Traccar gateway pool (JSON array). First entry can mirror SMS_GATEWAY_URL.");
console.log(`SMS_GATEWAY_POOL='${JSON.stringify(next)}'`);
console.log("\n# Optional: set default route to this phone");
console.log(`SMS_GATEWAY_URL=${gatewayUrl}`);
console.log(`SMS_GATEWAY_API_KEY=${apiKey}`);
console.log("SMS_GATEWAY_PROVIDER=traccar");
console.log("SMS_GATEWAY_METHOD=POST");
console.log("SMS_GATEWAY_QUEUE_MS=3000");

if (existing.length) {
  console.log(`\n(Appended to ${existing.length} existing gateway(s). Total: ${next.length})`);
} else {
  console.log("\n(New pool — paste the SMS_GATEWAY_POOL line into .env, then restart the server.)");
}

console.log("\nEntry added:");
console.log(`  id:  ${entryId}`);
console.log(`  url: ${gatewayUrl}`);
console.log("  key: (hidden — use token from Traccar app Settings → Gateway)\n");
