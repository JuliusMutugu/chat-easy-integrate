#!/usr/bin/env node
/**
 * 30-minute cheap SMS reseller launch: checklist, DB init, gateway pool, clients.
 * Usage: node scripts/launch-reseller-30min.mjs
 */
import "dotenv/config";
import { initDatabase, listSmsResellerClients } from "../server/database.js";

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

function maskKey(key) {
  if (!key) return "(none)";
  const s = String(key);
  if (s.length <= 8) return "****";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

const checklist = `
═══════════════════════════════════════════════════════════════
  30-MINUTE CHEAP SMS RESELLER LAUNCH (Kenya / Traccar phones)
═══════════════════════════════════════════════════════════════

  [ ] 1.  cp env.example .env — set SESSION_SECRET, SERVER_URL, CLIENT_URL
  [ ] 2.  Plug Android phone: Traccar SMS Gateway → Local Service ON
  [ ] 3.  Add phone to pool:
            node scripts/add-gateway-to-pool.mjs http://PHONE_IP:8082 TOKEN
  [ ] 4.  Set SMS_SELL_RATE_KES=0.30 (or tier rate in proposal)
  [ ] 5.  npm run dev  (or deploy — see docs/HOSTING_AND_FIRST_CUSTOMER.md)
  [ ] 6.  Business user + KYC approved (admin UI / sqlite one-liner)
  [ ] 7.  Onboard first client:
            node scripts/onboard-customer.mjs "Company" email@co.ke \\
              --registered SenderID --brand BrandName
  [ ] 8.  Smoke test:
            SMS_TEST_API_KEY=sms_live_... node scripts/test-client-api.mjs
  [ ] 9.  Share docs/SMS_CLIENT_API_INTEGRATION.md + proposal tier

  Docs: docs/SMS_CHEAP_RESELLER_KENYA.md
`;

console.log(checklist);

console.log("── Database ──");
await initDatabase();
console.log("✓ initDatabase() OK (server/messaging.db)\n");

console.log("── Gateway pool (SMS_GATEWAY_POOL + default) ──");
const pool = parseGatewayPool();
const defaultUrl = stripEnvQuotes(process.env.SMS_GATEWAY_URL || "");
const defaultKey = stripEnvQuotes(process.env.SMS_GATEWAY_API_KEY || "");

if (defaultUrl) {
  console.log(`  default SMS_GATEWAY_URL: ${defaultUrl}  key: ${maskKey(defaultKey)}`);
} else {
  console.log("  default SMS_GATEWAY_URL: (not set)");
}

if (pool.length === 0) {
  console.log("  SMS_GATEWAY_POOL: (empty — add phones with add-gateway-to-pool.mjs)");
} else {
  console.log(`  SMS_GATEWAY_POOL: ${pool.length} gateway(s)`);
  pool.forEach((g, i) => {
    const id = g.id || g.label || `gateway-${i + 1}`;
    const url = g.url || g.gatewayUrl || "(missing url)";
    console.log(`    [${i + 1}] ${id}: ${url}  key: ${maskKey(g.key || g.apiKey)}`);
  });
}

const sellRate = Number(process.env.SMS_SELL_RATE_KES);
if (Number.isFinite(sellRate)) {
  console.log(`  SMS_SELL_RATE_KES: ${sellRate}`);
}

console.log("\n── SMS reseller clients ──");
const clients = await listSmsResellerClients();
if (clients.length === 0) {
  console.log("  (none — run: node scripts/onboard-customer.mjs \"Company\" --registered SenderID)");
} else {
  for (const c of clients) {
    const mode = c.gatewayConfigured ? "dedicated" : "managed";
    const sender = c.senderId || "(no sender_id)";
    console.log(
      `  • ${c.providerName}  id=${c.id}  ${c.status}  ${mode}  sender=${sender}  KES ${c.sellRateKes}/SMS`
    );
  }
}

console.log("\nDone. Next: onboard a customer or run test-client-api.mjs\n");
