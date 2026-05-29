#!/usr/bin/env node
/**
 * Verify bulk SMS platform — run this, read PASS/FAIL. No theory.
 */
import "dotenv/config";
import { initDatabase, listSmsResellerClients } from "../server/database.js";
import { loadOperatorGateways } from "../server/services/operatorGateways.js";
import { resolveGatewayForRecipient } from "../server/services/operatorGateways.js";

const BASE = process.env.SERVER_URL || "http://localhost:3001";
let pass = 0;
let fail = 0;

function ok(label) {
  console.log("  PASS", label);
  pass++;
}
function no(label, detail = "") {
  console.log("  FAIL", label, detail ? `— ${detail}` : "");
  fail++;
}

console.log("\n=== BULK SMS PLATFORM VERIFY ===\n");

await initDatabase();
ok("Database");

const ops = loadOperatorGateways();
if (ops.length) {
  ok(`Operator gateways: ${ops.map((o) => o.id).join(", ")}`);
} else {
  no("No SMPP gateway", "Set SMPP_GATEWAY_URL or SMPP_GATEWAY_SAFARICOM_URL in .env");
}

const to071 = resolveGatewayForRecipient("254713558761");
const to073 = resolveGatewayForRecipient("254731234567");
if (ops.length > 1) {
  if (to071?.matchedOperator !== to073?.matchedOperator) {
    ok(`Multi-operator routing: 071→${to071?.matchedOperator} 073→${to073?.matchedOperator}`);
  } else {
    no("Multi-operator routing", "same gateway for different prefixes");
  }
} else if (ops.length === 1) {
  ok(`Single gateway: ${ops[0].id}`);
}

const clients = await listSmsResellerClients();
if (!clients.length) {
  no("No tenants", "node scripts/onboard-customer.mjs \"Co\" x@y.com --phone 2547...");
} else {
  ok(`${clients.length} tenant(s)`);
  for (const c of clients) {
    if (c.originatorPhone) ok(`${c.providerName}: from ${c.originatorPhone}`);
    else no(`${c.providerName}: missing originator_phone`);
  }
}

let healthOk = false;
try {
  const h = await fetch(`${BASE}/api/health`);
  healthOk = h.ok;
} catch (e) {
  no("Server", `not running at ${BASE} — npm start`);
}

if (healthOk) {
  ok(`Server ${BASE}`);
  const tenant = clients.find((c) => c.originatorPhone);
  if (tenant) {
    const keyRow = await import("../server/database.js").then((m) =>
      m.getSmsResellerClientById(tenant.id, { includeFullApiKey: true })
    );
    const apiKey = keyRow?.apiKey;
    if (apiKey) {
      const acc = await fetch(`${BASE}/api/v1/account`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const accBody = await acc.json();
      if (acc.ok && accBody.canSend) ok(`Tenant API canSend (${accBody.originatingPhone})`);
      else no("Tenant canSend false", accBody.note || "");

      const send = await fetch(`${BASE}/api/v1/sms/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          to: "254713558761",
          body: "Platform verify test",
        }),
      });
      const sendBody = await send.json();
      if (send.ok) {
        ok(`Send API ${send.status} route=${sendBody.route} from=${sendBody.originatingPhone || sendBody.customerPhone}`);
        if (sendBody.simulated) {
          console.log("       (simulate — no handset SMS until SMPP URLs are live)");
        }
      } else {
        no("Send API", sendBody.error || send.status);
      }
    }
  }
}

console.log(`\n=== ${pass} passed, ${fail} failed ===\n`);
if (fail === 0) {
  console.log("Platform logic OK. For REAL SMS: add operator SMPP URLs to .env (see below).\n");
} else {
  console.log("Fix FAIL lines above.\n");
}

console.log(`YOUR .env (copy — use one line per operator YOU sign with):

# Safaricom bind (when you have credentials)
# SMPP_GATEWAY_SAFARICOM_URL=http://127.0.0.1:13013/cgi-bin/sendsms
# SMPP_GATEWAY_SAFARICOM_PREFIXES=25470,25471,25472,25474,25479,25411

# Airtel bind (separate contract — not Safaricom)
# SMPP_GATEWAY_AIRTEL_URL=http://127.0.0.1:13014/cgi-bin/sendsms
# SMPP_GATEWAY_AIRTEL_PREFIXES=25473,25478,25410,25401

SMPP_GATEWAY_FORMAT=kannel
SMPP_KANNEL_USER=platform
SMPP_KANNEL_PASSWORD=your-password
`);

process.exit(fail > 0 ? 1 : 0);
