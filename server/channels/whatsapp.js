/**
 * WhatsApp channel – our own adapter layer.
 * No Twilio dependency. You plug your own provider (Meta WhatsApp Business API or compatible).
 * Config: { apiUrl, token?, phoneId? } – we POST to your API; you implement the provider.
 */

export async function sendWhatsApp(config, { to, body }) {
  if (!config) throw new Error("WhatsApp config missing");
  const { apiUrl, token, phoneId } = config;

  if (!apiUrl || typeof apiUrl !== "string") {
    throw new Error("WhatsApp config missing apiUrl. Configure your WhatsApp Business API endpoint.");
  }

  const url = apiUrl.replace(/\/$/, "");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const payload = { to: String(to).replace(/\D/g, ""), text: String(body || "").trim() };
  if (phoneId) payload.phoneId = phoneId;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp gateway error ${res.status}: ${errText || res.statusText}`);
  }

  let externalId = null;
  try {
    const data = await res.json();
    externalId = data.id ?? data.messageId ?? data.messages?.[0]?.id ?? null;
  } catch (_) {}

  return { success: true, externalId };
}

/**
 * Development stub: no apiUrl → log only.
 */
export async function sendWhatsAppDev(config, { to, body }) {
  if (config && config.apiUrl) return sendWhatsApp(config, { to, body });
  console.log("[WhatsApp dev] to=%s body=%s", to, body);
  return { success: true, externalId: `wa-dev-${Date.now()}` };
}

export function validateWhatsAppConfig(config) {
  if (!config) return { valid: false, error: "No config" };
  if (!config.apiUrl) return { valid: false, error: "Missing apiUrl (your WhatsApp API endpoint)" };
  return { valid: true };
}
