/**
 * Per-tenant sender IDs for SaaS SMS resale.
 * Each customer has their own registered_sender_id (Kenya max 11 chars on network).
 * brand_sender_name is optional long display name (message prefix on phone gateways).
 */

const KENYA_SENDER_ID_MAX = 11;

/** Normalize for MNO alphanumeric sender ID (per tenant, no global brand map). */
export function normalizeKenyaSenderId(raw) {
  if (raw == null || raw === "") return null;
  let s = String(raw).trim().replace(/\s+/g, "");
  if (!s) return null;
  if (s.length > KENYA_SENDER_ID_MAX) {
    s = s.slice(0, KENYA_SENDER_ID_MAX);
  }
  return s;
}

/**
 * Resolve tenant sender fields from DB.
 * - registeredSenderId: unique per customer (sender_id column), used on aggregator From line
 * - brandSenderName: marketing name; used in [prefix] when on shared/dedicated phone gateway
 */
export function resolveTenantSender({ senderId, brandSenderName, providerName }) {
  const registeredSenderId = normalizeKenyaSenderId(senderId);
  const brand =
    (brandSenderName && String(brandSenderName).replace(/\s+/g, "")) ||
    (registeredSenderId ? null : providerName ? String(providerName).replace(/\s+/g, "") : null);

  const brandNorm = brand ? String(brand).replace(/\s+/g, "") : null;
  const regNorm = registeredSenderId ? String(registeredSenderId).replace(/\s+/g, "") : null;

  return {
    registeredSenderId,
    brandSenderName: brand || registeredSenderId,
    /** API alias — the ID this tenant is sold under */
    senderId: registeredSenderId || brandNorm,
    senderIdNote: !registeredSenderId
      ? "No registered sender ID set for this tenant. Admin must assign a unique sender_id (max 11 characters) for proper SaaS branding."
      : brandNorm && regNorm && brandNorm.toLowerCase() !== regNorm.toLowerCase()
        ? `Registered sender ID "${registeredSenderId}" on the From line; brand "${brand}" may appear in message prefix on phone gateways.`
        : `Registered sender ID "${registeredSenderId}" for this tenant.`,
  };
}

export function isPhoneSmsGateway(config) {
  const provider = (config?.provider ?? process.env.SMS_GATEWAY_PROVIDER ?? "traccar")
    .toString()
    .toLowerCase();
  return provider === "traccar";
}

/** SMPP: From = customer's MSISDN. Traccar: SIM is the number (no override). */
export function applySenderToGatewayConfig(config, smsClient) {
  if (!smsClient) return config;
  const next = { ...config };
  if (isPhoneSmsGateway(config)) {
    next.senderId = "";
    return next;
  }
  const fromPhone = smsClient.originatorPhone
    ? String(smsClient.originatorPhone).trim()
    : null;
  if (fromPhone) {
    next.senderId = fromPhone.replace(/\s+/g, "");
  }
  return next;
}

export function applyBrandPrefixToBody(body, brandSenderName) {
  const text = String(body ?? "").trim();
  const brand = brandSenderName ? String(brandSenderName).replace(/\s+/g, "") : "";
  if (!brand || !text) return text;

  const prefixEnv = (process.env.SMS_BRAND_PREFIX ?? "1").toLowerCase();
  if (prefixEnv === "0" || prefixEnv === "false" || prefixEnv === "off") {
    return text;
  }

  const tag = `[${brand}]`;
  if (text.startsWith(tag)) return text;
  return `${tag} ${text}`;
}
