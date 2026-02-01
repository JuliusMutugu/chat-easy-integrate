/**
 * SMS channel – our own engine interface.
 * No Twilio dependency. You plug your own gateway (SMPP, HTTP API, or local stub).
 * Config: { gatewayUrl, apiKey?, method? } – we POST to gatewayUrl with { to, body }.
 * Your gateway implements the actual carrier/SMS logic.
 */

export async function sendSms(config, { to, body }) {
  if (!config) throw new Error("SMS config missing");
  const { gatewayUrl, apiKey, method = "POST" } = config;

  if (!gatewayUrl || typeof gatewayUrl !== "string") {
    throw new Error("SMS config missing gatewayUrl. Set your own gateway (e.g. your SMPP/HTTP service).");
  }

  const url = gatewayUrl.replace(/\/$/, "");
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify({ to: String(to).trim(), body: String(body || "").trim() }),
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

/**
 * Development stub: no gatewayUrl → log only (no external dependency).
 */
export async function sendSmsDev(config, { to, body }) {
  if (config && config.gatewayUrl) return sendSms(config, { to, body });
  console.log("[SMS dev] to=%s body=%s", to, body);
  return { success: true, externalId: `dev-${Date.now()}` };
}

export function validateSmsConfig(config) {
  if (!config) return { valid: false, error: "No config" };
  if (!config.gatewayUrl) return { valid: false, error: "Missing gatewayUrl (your SMS gateway URL)" };
  return { valid: true };
}
