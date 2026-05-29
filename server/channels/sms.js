/**
 * SMS channel – Traccar Android gateway (default) or generic HTTP gateway.
 */

import {
  getTraccarConfig,
  sendTraccarSmsQueued,
  validateTraccarConfig,
} from "../services/traccarSmsGateway.js";

function useTraccarGateway(config) {
  const provider = (config?.provider ?? process.env.SMS_GATEWAY_PROVIDER ?? "traccar")
    .toString()
    .toLowerCase();
  return provider === "traccar";
}

/** Generic gateway: POST { to, body } with optional Bearer token */
export async function sendSmsGeneric(config, { to, body }) {
  if (!config) throw new Error("SMS config missing");
  const { gatewayUrl, apiKey, method = "POST" } = config;

  if (!gatewayUrl || typeof gatewayUrl !== "string") {
    throw new Error("SMS config missing gatewayUrl.");
  }

  const url = gatewayUrl.replace(/\/$/, "");
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const toStr = Array.isArray(to) ? to.join(",") : String(to).trim();
  const payload = { to: toStr, body: String(body || "").trim() };
  if (config.senderId) {
    payload.from = config.senderId;
    payload.sender = config.senderId;
    payload.senderId = config.senderId;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SMS gateway error ${res.status}: ${errText || res.statusText}`);
  }

  let externalId = null;
  try {
    const data = await res.json();
    externalId = data.id ?? data.messageId ?? data.sid ?? null;
  } catch (_) {}

  return { success: true, externalId };
}

/** Send SMS through configured gateway (queued for Traccar) */
export async function sendSmsWithConfig(config, { to, body }) {
  const merged = { ...getTraccarConfig(), ...(config || {}) };

  if (merged.gatewayUrl && useTraccarGateway(merged)) {
    return sendTraccarSmsQueued(merged, { to, body });
  }

  if (merged.gatewayUrl) {
    return sendSmsGeneric(merged, { to, body });
  }

  return sendSmsDev(null, { to, body });
}

/** Development stub: no config → log only */
export async function sendSmsDev(config, { to, body }) {
  const merged = { ...getTraccarConfig(), ...(config || {}) };
  if (merged.gatewayUrl) return sendSmsWithConfig(merged, { to, body });
  console.log("[SMS dev] to=%s body=%s", to, body);
  return { success: true, externalId: `dev-${Date.now()}` };
}

export function validateSmsConfig(config) {
  const merged = { ...getTraccarConfig(), ...(config || {}) };
  if (!merged.gatewayUrl) {
    return { valid: false, error: "Missing gatewayUrl (SMS_GATEWAY_URL)" };
  }
  if (useTraccarGateway(merged)) {
    return validateTraccarConfig(merged);
  }
  return { valid: true };
}
