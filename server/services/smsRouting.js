/**
 * SaaS SMS routing: each tenant has their own registered sender ID.
 *
 * Routes:
 *   registered  – HTTP aggregator with tenant sender_id (unique From line per customer)
 *   dedicated   – Tenant's own Traccar phone/SIM
 *   managed_phone – Shared platform phone (same SIM/From for all; brand prefix only)
 */

import {
  resolveTenantSender,
  applySenderToGatewayConfig,
  applyBrandPrefixToBody,
  isPhoneSmsGateway,
} from "./senderId.js";

function stripEnvQuotes(val) {
  if (val == null || typeof val !== "string") return val;
  const s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/** Platform aggregator for MNO-registered alphanumeric sender IDs (per tenant). */
export function getAggregatorConfigFromEnv() {
  const gatewayUrl = process.env.SMS_AGGREGATOR_URL;
  if (!gatewayUrl) return null;
  return {
    gatewayUrl: stripEnvQuotes(String(gatewayUrl)).replace(/\/$/, ""),
    apiKey: stripEnvQuotes(String(process.env.SMS_AGGREGATOR_API_KEY || "")),
    method: (process.env.SMS_AGGREGATOR_METHOD || "POST").toUpperCase(),
    provider: (process.env.SMS_AGGREGATOR_PROVIDER || "aggregator").toLowerCase(),
  };
}

/**
 * Pick gateway + whether body brand prefix is needed.
 * @returns {{ route: string, config: object, senderMeta: object, useBrandPrefix: boolean, fromLineBehavior: string }}
 */
export async function resolveSmsDelivery({ fullClient, getPlatformPhoneConfig }) {
  const senderMeta = resolveTenantSender(fullClient || {});

  if (fullClient?.gatewayConfigured) {
    const config = applySenderToGatewayConfig(
      {
        gatewayUrl: fullClient.gatewayUrl || "",
        apiKey: fullClient.gatewayApiKey || "",
        method: (fullClient.gatewayMethod || "POST").toUpperCase(),
        provider: (fullClient.gatewayProvider || "traccar").toLowerCase(),
      },
      fullClient
    );
    return {
      route: "dedicated",
      config,
      senderMeta,
      useBrandPrefix: isPhoneSmsGateway(config),
      fromLineBehavior: isPhoneSmsGateway(config) ? "dedicated_sim" : "registered",
    };
  }

  if (fullClient) {
    const aggregator = getAggregatorConfigFromEnv();
    if (senderMeta.registeredSenderId && aggregator?.gatewayUrl) {
      const config = applySenderToGatewayConfig(aggregator, fullClient);
      return {
        route: "registered",
        config,
        senderMeta,
        useBrandPrefix: false,
        fromLineBehavior: "registered_sender_id",
      };
    }

    const phoneConfig = applySenderToGatewayConfig(
      await getPlatformPhoneConfig(fullClient?.id ?? null),
      fullClient
    );
    return {
      route: "managed_phone",
      config: phoneConfig,
      senderMeta,
      useBrandPrefix: true,
      fromLineBehavior: "shared_sim",
    };
  }

  const config = await getPlatformPhoneConfig(null);
  return {
    route: "platform",
    config,
    senderMeta,
    useBrandPrefix: isPhoneSmsGateway(config),
    fromLineBehavior: isPhoneSmsGateway(config) ? "shared_sim" : "registered",
  };
}

export function buildOutboundSmsBody(body, { useBrandPrefix, senderMeta }) {
  const text = String(body ?? "").trim();
  if (!useBrandPrefix) return text;
  return applyBrandPrefixToBody(text, senderMeta.brandSenderName);
}

export function describeFromLineForAccount({ fromLineBehavior, senderMeta, route }) {
  if (fromLineBehavior === "registered_sender_id") {
    return {
      fromLineBehavior,
      registeredSenderId: senderMeta.registeredSenderId,
      senderIdSharedWithOtherTenants: false,
      note: `Each message uses your registered sender ID "${senderMeta.registeredSenderId}" on the From line.`,
    };
  }
  if (fromLineBehavior === "dedicated_sim") {
    return {
      fromLineBehavior,
      registeredSenderId: senderMeta.registeredSenderId,
      senderIdSharedWithOtherTenants: false,
      note: "SMS is sent from your dedicated SIM. Recipients see your phone number (or their saved contact name for that number).",
    };
  }
  return {
    fromLineBehavior,
    registeredSenderId: senderMeta.registeredSenderId,
    senderIdSharedWithOtherTenants: true,
    note: `Shared phone gateway: all tenants show the same SIM on the From line (e.g. a saved contact name like "wme"). Your brand "${senderMeta.brandSenderName}" appears in the message prefix only. For a unique From line per customer, set SMS_AGGREGATOR_URL (registered sender IDs) or assign a dedicated gateway per tenant.`,
  };
}
