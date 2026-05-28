/**
 * SMS channel – provider-agnostic gateway only.
 * Configure your own SMPP/HTTP route in config: { gatewayUrl, apiKey?, method? }.
 */

/** Send via generic gateway (POST { to, body }) */
export async function sendSms(config, { to, body }) {
  if (!config) throw new Error("SMS config missing");
  const { gatewayUrl, apiKey, method = "POST" } = config;

  if (!gatewayUrl || typeof gatewayUrl !== "string") {
    throw new Error("SMS config missing gatewayUrl. Set your own gateway (e.g. SMPP/HTTP service).");
  }

  const url = gatewayUrl.replace(/\/$/, "");
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const toStr = Array.isArray(to) ? to.join(",") : String(to).trim();
  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify({ to: toStr, body: String(body || "").trim() }),
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

/** Send SMS through your gateway, else dev stub */
export async function sendSmsWithConfig(config, { to, body }) {
  if (config?.gatewayUrl) {
    return sendSms(config, { to, body });
  }
  return sendSmsDev(null, { to, body });
}

/** Development stub: no config → log only */
export async function sendSmsDev(config, { to, body }) {
  if (config && config.gatewayUrl) return sendSms(config, { to, body });
  console.log("[SMS dev] to=%s body=%s", to, body);
  return { success: true, externalId: `dev-${Date.now()}` };
}

export function validateSmsConfig(config) {
  if (!config) return { valid: false, error: "No config" };
  if (!config.gatewayUrl) return { valid: false, error: "Missing gatewayUrl for your SMS route" };
  return { valid: true };
}
