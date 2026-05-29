/**
 * Multi-operator gateways — you are NOT locked to Safaricom or Airtel.
 * Add one SMPP bind per operator you contract with; route by recipient prefix.
 */

import { normalizePhoneNumber } from "./traccarSmsGateway.js";

function stripEnvQuotes(val) {
  if (val == null || typeof val !== "string") return val;
  const s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function baseGatewayConfig(overrides = {}) {
  return {
    method: (overrides.method || process.env.SMPP_GATEWAY_METHOD || "POST").toUpperCase(),
    provider: (overrides.provider || process.env.SMPP_GATEWAY_PROVIDER || "smpp").toLowerCase(),
    gatewayFormat: overrides.gatewayFormat || process.env.SMPP_GATEWAY_FORMAT || "",
    apiKey: overrides.apiKey || "",
    kannelUser: overrides.kannelUser || process.env.SMPP_KANNEL_USER || "",
    kannelPassword: overrides.kannelPassword || process.env.SMPP_KANNEL_PASSWORD || "",
  };
}

/** Load operator routes from SMS_OPERATORS_JSON or per-operator env vars. */
export function loadOperatorGateways() {
  const list = [];

  const raw = process.env.SMS_OPERATORS_JSON;
  if (raw) {
    try {
      const parsed = JSON.parse(stripEnvQuotes(String(raw)));
      for (const op of parsed) {
        if (!op?.url && !op?.gatewayUrl) continue;
        list.push({
          id: op.id || op.name || "operator",
          prefixes: op.prefixes || op.prefix || [],
          gatewayUrl: String(op.url || op.gatewayUrl).replace(/\/$/, ""),
          ...baseGatewayConfig(op),
          apiKey: op.apiKey || op.password || "",
          kannelUser: op.kannelUser || op.username || "",
          kannelPassword: op.kannelPassword || op.password || "",
        });
      }
    } catch (e) {
      console.error("[operatorGateways] SMS_OPERATORS_JSON parse error:", e.message);
    }
  }

  const pairs = [
    ["safaricom", "SMPP_GATEWAY_SAFARICOM_URL", "25470,25471,25472,25474,25479,25411"],
    ["airtel", "SMPP_GATEWAY_AIRTEL_URL", "25473,25478,25410,25401,25475"],
    ["telkom", "SMPP_GATEWAY_TELKOM_URL", "25477"],
  ];

  for (const [id, envKey, defaultPrefixes] of pairs) {
    const url = process.env[envKey];
    if (!url) continue;
    const prefixEnv = process.env[`${envKey.replace("_URL", "_PREFIXES")}`] || defaultPrefixes;
    list.push({
      id,
      prefixes: prefixEnv.split(",").map((p) => p.trim()).filter(Boolean),
      gatewayUrl: stripEnvQuotes(String(url)).replace(/\/$/, ""),
      ...baseGatewayConfig({}),
    });
  }

  const fallback = process.env.SMPP_GATEWAY_URL || process.env.SMS_AGGREGATOR_URL;
  if (fallback) {
    list.push({
      id: "default",
      prefixes: ["*"],
      gatewayUrl: stripEnvQuotes(String(fallback)).replace(/\/$/, ""),
      ...baseGatewayConfig({}),
      apiKey: stripEnvQuotes(String(process.env.SMPP_GATEWAY_API_KEY || "")),
    });
  }

  return list;
}

/** Pick gateway for destination MSISDN (Kenya prefix rules; extend per country). */
export function resolveGatewayForRecipient(to) {
  const gateways = loadOperatorGateways();
  if (gateways.length === 0) return null;

  const phone = normalizePhoneNumber(Array.isArray(to) ? to[0] : to);
  const digits = phone.replace(/\D/g, "");

  for (const gw of gateways) {
    if (gw.prefixes.includes("*")) continue;
    for (const p of gw.prefixes) {
      const pref = p.replace(/\D/g, "");
      if (digits.startsWith(pref)) {
        return { ...gw, matchedOperator: gw.id, recipient: phone };
      }
    }
  }

  const wildcard = gateways.find((g) => g.prefixes.includes("*"));
  if (wildcard) return { ...wildcard, matchedOperator: wildcard.id, recipient: phone };

  return { ...gateways[0], matchedOperator: gateways[0].id, recipient: phone };
}

export function listConfiguredOperators() {
  return loadOperatorGateways().map((g) => ({
    id: g.id,
    url: g.gatewayUrl,
    prefixes: g.prefixes,
  }));
}
