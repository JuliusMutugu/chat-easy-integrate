/**
 * SMS channel – Africa's Talking + generic gateway.
 * Africa's Talking: set AFRICASTALKING_USERNAME, AFRICASTALKING_API_KEY in .env.
 * Generic: config { gatewayUrl, apiKey?, method? } – POST to gatewayUrl with { to, body }.
 */

const AFRICASTALKING_SANDBOX_URL = "https://api.sandbox.africastalking.com/version1/messaging";
const AFRICASTALKING_LIVE_URL = "https://api.africastalking.com/version1/messaging";

/** Send via Africa's Talking bulk SMS API */
export async function sendSmsAfricaTalking(config, { to, body }) {
  if (!config) throw new Error("SMS config missing");
  const { username, apiKey, sandbox = true, senderId } = config;
  if (!username || !apiKey) {
    throw new Error("Africa's Talking requires username and apiKey");
  }

  const baseUrl = sandbox ? AFRICASTALKING_SANDBOX_URL : AFRICASTALKING_LIVE_URL;
  const toStr = Array.isArray(to) ? to.join(",") : String(to).trim();
  const message = String(body || "").trim();

  const params = new URLSearchParams();
  params.set("username", username);
  params.set("to", toStr);
  params.set("message", message);
  if (senderId) params.set("from", senderId);

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      apikey: apiKey,
    },
    body: params.toString(),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(`Africa's Talking error ${res.status}: ${text || res.statusText}`);
  }

  if (!res.ok) {
    const errMsg = data.errorMessage || data.error || data.message || text || res.statusText;
    throw new Error(`Africa's Talking error ${res.status}: ${errMsg}`);
  }

  // Response: SMSMessageData.Recipients[] - check status per recipient
  const recipients = data?.SMSMessageData?.Recipients || [];
  let externalId = null;
  const first = recipients[0];
  if (first?.messageId && String(first.messageId).toLowerCase() !== "none") {
    externalId = first.messageId;
  }

  // Include recipient status for debugging (success/failure per number)
  const recipientStatus = recipients.map((r) => ({
    number: r.number,
    status: r.status,
    statusCode: r.statusCode,
    messageId: r.messageId,
    cost: r.cost,
  }));

  return { success: true, externalId, recipientStatus };
}

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

/** Send SMS – prefers Africa's Talking if configured, else generic gateway, else dev stub */
export async function sendSmsWithConfig(config, { to, body }) {
  if (!config) {
    return sendSmsDev(null, { to, body });
  }
  if (config.provider === "africastalking" || (config.username && config.apiKey && !config.gatewayUrl)) {
    return sendSmsAfricaTalking(config, { to, body });
  }
  if (config.gatewayUrl) {
    return sendSms(config, { to, body });
  }
  return sendSmsDev(null, { to, body });
}

/** Development stub: no config → log only */
export async function sendSmsDev(config, { to, body }) {
  if (config?.provider === "africastalking" && config?.username && config?.apiKey) {
    return sendSmsAfricaTalking(config, { to, body });
  }
  if (config && config.gatewayUrl) return sendSms(config, { to, body });
  console.log("[SMS dev] to=%s body=%s", to, body);
  return { success: true, externalId: `dev-${Date.now()}` };
}

export function validateSmsConfig(config) {
  if (!config) return { valid: false, error: "No config" };
  // Africa's Talking
  if (config.provider === "africastalking" || (config.username && config.apiKey)) {
    if (!config.username || !config.apiKey) {
      return { valid: false, error: "Africa's Talking requires username and apiKey" };
    }
    return { valid: true };
  }
  // Generic gateway
  if (!config.gatewayUrl) return { valid: false, error: "Missing gatewayUrl or Africa's Talking credentials" };
  return { valid: true };
}
