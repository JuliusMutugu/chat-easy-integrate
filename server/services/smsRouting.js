/**
 * Global SMS SaaS — YOU host the gateway on your server.
 * Customers only get an API key + their originating number (registered on your SMPP bind).
 * No Traccar, no app on their phone.
 */

import { applySenderToGatewayConfig, isPhoneSmsGateway } from "./senderId.js";
import { normalizePhoneNumber } from "./traccarSmsGateway.js";
import { resolveGatewayForRecipient, loadOperatorGateways } from "./operatorGateways.js";

function stripEnvQuotes(val) {
  if (val == null || typeof val !== "string") return val;
  const s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function isDevSimulateEnabled() {
  return false;
}

/** Any SMPP gateway configured (single or multi-operator). */
export function getSmppGatewayConfigFromEnv(to = null) {
  if (to) {
    const routed = resolveGatewayForRecipient(to);
    if (routed) return routed;
  }
  const all = loadOperatorGateways();
  return all[0] || null;
}

export const getAggregatorConfigFromEnv = getSmppGatewayConfigFromEnv;

/**
 * Tenant send: platform-hosted gateway + customer originator_phone as From address.
 */
export async function resolveSmsDelivery({ fullClient, getPlatformPhoneConfig, to = null }) {
  const customerPhone = fullClient?.originatorPhone
    ? normalizePhoneNumber(fullClient.originatorPhone)
    : null;

  if (fullClient && customerPhone) {
    // Real tenant sends ONLY via your SMPP bind with their number as `from`.
    // Traccar/phone cannot spoof another MSISDN — the SIM in the device IS the sender.
    const smpp = getSmppGatewayConfigFromEnv(to);
    if (smpp?.gatewayUrl) {
      const config = applySenderToGatewayConfig(smpp, {
        ...fullClient,
        originatorPhone: customerPhone,
      });
      return {
        route: "tenant_smpp",
        config,
        customerPhone,
        matchedOperator: smpp.matchedOperator || null,
        useBrandPrefix: false,
        fromLineBehavior: "customer_phone",
      };
    }

  }

  if (fullClient) {
    return {
      route: "not_configured",
      config: null,
      customerPhone,
      useBrandPrefix: false,
      fromLineBehavior: "not_configured",
    };
  }

  const config = await getPlatformPhoneConfig(null);
  return {
    route: "platform_admin",
    config,
    customerPhone: null,
    useBrandPrefix: isPhoneSmsGateway(config),
    fromLineBehavior: "platform_owner",
  };
}

export function buildOutboundSmsBody(body) {
  return String(body ?? "").trim();
}

export function assertTenantSendsAsCustomer(delivery, fullClient) {
  if (!fullClient) return;

  if (delivery.route === "tenant_smpp") {
    return;
  }

  const phone = fullClient.originatorPhone
    ? normalizePhoneNumber(fullClient.originatorPhone)
    : null;

  const err = new Error(
    phone
      ? `Cannot send as ${phone} without SMPP_GATEWAY_URL on your server. ` +
          `A phone on your desk cannot show a different sender — the SIM in the device is what recipients see. ` +
          `Register ${phone} on your SMPP/MNO bind, then send. No simulate, no borrowed SIMs.`
      : `Set originator_phone for this tenant (their MSISDN, e.g. +254717348043).`
  );
  err.status = 503;
  err.code = "PLATFORM_GATEWAY_REQUIRED";
  throw err;
}

export function describeFromLineForAccount({ fromLineBehavior, customerPhone, fullClient }) {
  const smppReady = loadOperatorGateways().length > 0;

  if (fromLineBehavior === "customer_phone" && customerPhone) {
    return {
      fromLineBehavior,
      originatingPhone: customerPhone,
      deliveryModel: "platform_smpp",
      senderIdSharedWithOtherTenants: false,
      canSend: smppReady,
      note: smppReady
        ? `SMPP live: recipients see ${customerPhone}. Customer installs nothing.`
        : `Set SMPP_GATEWAY_URL on your server and register ${customerPhone} with your operator.`,
    };
  }

  return {
    fromLineBehavior: "not_configured",
    originatingPhone: customerPhone || null,
    deliveryModel: "platform_hosted",
    senderIdSharedWithOtherTenants: false,
    canSend: false,
    note: fullClient?.originatorPhone
      ? "Configure SMPP_GATEWAY_URL on your server."
      : "Set originator_phone for this tenant (their MSISDN, e.g. +254717348043).",
  };
}
