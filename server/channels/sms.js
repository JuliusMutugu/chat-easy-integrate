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

function useKannelFormat(config) {
  const fmt = (
    config?.gatewayFormat ??
    process.env.SMPP_GATEWAY_FORMAT ??
    ""
  )
    .toString()
    .toLowerCase();
  return fmt === "kannel";
}

/** Kannel sendsms: GET/POST query username password to from text */
async function sendSmsKannel(config, { to, body }) {
  const { gatewayUrl, apiKey, method = "GET" } = config;
  const url = new URL(gatewayUrl.replace(/\/$/, ""));
  const toStr = Array.isArray(to) ? to[0] : String(to).trim();
  const text = String(body || "").trim();
  const user = process.env.SMPP_KANNEL_USER || config.kannelUser || "";
  const pass = process.env.SMPP_KANNEL_PASSWORD || config.kannelPassword || apiKey || "";

  url.searchParams.set("username", user);
  url.searchParams.set("password", pass);
  url.searchParams.set("to", toStr.replace(/^\+/, ""));
  url.searchParams.set("text", text);
  if (config.senderId) {
    url.searchParams.set("from", String(config.senderId).replace(/^\+/, ""));
  }

  const res = await fetch(url.toString(), { method: method === "POST" ? "POST" : "GET" });
  const responseText = await res.text();
  if (!res.ok) {
    throw new Error(`Kannel sendsms HTTP ${res.status}: ${responseText || res.statusText}`);
  }
  return { success: true, externalId: `kannel-${Date.now()}`, response: responseText };
}

/** Generic gateway: POST JSON { to, body, from } or Kannel query format */
export async function sendSmsGeneric(config, { to, body }) {
  if (!config) throw new Error("SMS config missing");
  const { gatewayUrl, apiKey, method = "POST" } = config;

  if (!gatewayUrl || typeof gatewayUrl !== "string") {
    throw new Error("SMS config missing gatewayUrl.");
  }

  if (useKannelFormat(config)) {
    return sendSmsKannel(config, { to, body });
  }

  const url = gatewayUrl.replace(/\/$/, "");
  const headers = { "Content-Type": "application/json" };

  const toStr = Array.isArray(to) ? to.join(",") : String(to).trim();
  const text = String(body || "").trim();
  const payload = { to: toStr, body: text, message: text };
  if (config.senderId) {
    payload.from = config.senderId;
    payload.sender = config.senderId;
    payload.senderId = config.senderId;
  }
  if (apiKey) {
    headers["Authorization"] = apiKey.includes("Bearer") ? apiKey : `Bearer ${apiKey}`;
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

/** Dev: log tenant send with customer's From number (no Traccar on customer side). */
export async function sendSmsSimulated({ to, body, from }) {
  const toStr = Array.isArray(to) ? to.join(",") : String(to);
  console.log("[SMS simulate] from=%s to=%s body=%s", from, toStr, body);
  return {
    success: true,
    simulated: true,
    from,
    to: toStr,
    externalId: `sim-${Date.now()}`,
  };
}

/** Send SMS through configured gateway (queued for Traccar) */
export async function sendSmsWithConfig(config, { to, body, simulateFrom = null }) {
  if (simulateFrom) {
    return sendSmsSimulated({ to, body, from: simulateFrom });
  }

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

export function validateSmsConfig(config, { allowSimulate = false } = {}) {
  if (allowSimulate) return { valid: true };
  const merged = { ...getTraccarConfig(), ...(config || {}) };
  if (!merged.gatewayUrl) {
    return { valid: false, error: "Missing gatewayUrl (SMPP_GATEWAY_URL or SMS_GATEWAY_URL)" };
  }
  if (useTraccarGateway(merged)) {
    return validateTraccarConfig(merged);
  }
  return { valid: true };
}
