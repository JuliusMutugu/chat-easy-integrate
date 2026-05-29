/**
 * Traccar SMS Gateway (Android phone as local SMS router).
 *
 * Env:
 *   SMS_GATEWAY_URL          e.g. http://192.168.1.50:8082 (single phone; see smsGatewayPool.js for multi-phone)
 *   SMS_GATEWAY_API_KEY      token from Traccar app (Settings → Gateway)
 *   SMS_GATEWAY_METHOD       POST (default)
 *   SMS_GATEWAY_QUEUE_MS     delay between sends (default 3000)
 *   SMS_GATEWAY_TIMEOUT_MS   request timeout (default 15000)
 */

import PQueue from "p-queue";

const DEFAULT_QUEUE_MS = 3000;
const DEFAULT_TIMEOUT_MS = 15000;

/** Per-gateway queues so one tenant's phone is not blocked by another's traffic */
const sendQueues = new Map();

function getQueueIntervalMs() {
  const n = Number(process.env.SMS_GATEWAY_QUEUE_MS ?? DEFAULT_QUEUE_MS);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_QUEUE_MS;
}

function getRequestTimeoutMs() {
  const n = Number(process.env.SMS_GATEWAY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

function getSendQueue(config) {
  const key = config?.gatewayUrl || "__default__";
  if (!sendQueues.has(key)) {
    const interval = getQueueIntervalMs();
    sendQueues.set(
      key,
      new PQueue({
        concurrency: 1,
        interval,
        intervalCap: 1,
      })
    );
  }
  return sendQueues.get(key);
}

/** Build config from env and/or partial overrides (Integrations UI). */
export function getTraccarConfig(overrides = {}) {
  const gatewayUrl = overrides.gatewayUrl ?? process.env.SMS_GATEWAY_URL;
  const apiKey = overrides.apiKey ?? process.env.SMS_GATEWAY_API_KEY;
  const method = (overrides.method ?? process.env.SMS_GATEWAY_METHOD ?? "POST").toUpperCase();

  return {
    gatewayUrl: gatewayUrl ? String(gatewayUrl).trim().replace(/\/$/, "") : "",
    apiKey: apiKey ? String(apiKey).trim() : "",
    method,
    senderId: overrides.senderId ? String(overrides.senderId).trim() : "",
  };
}

export function validateTraccarConfig(config) {
  if (!config?.gatewayUrl) {
    return { valid: false, error: "SMS_GATEWAY_URL is required (e.g. http://192.168.1.50:8082)" };
  }
  if (!config.apiKey) {
    return { valid: false, error: "SMS_GATEWAY_API_KEY is required (token from Traccar app)" };
  }
  return { valid: true };
}

/**
 * Normalize Kenyan numbers toward E.164 (+254...).
 * Traccar accepts +prefix; local 07... is converted when possible.
 */
export function normalizePhoneNumber(raw) {
  let s = String(raw ?? "").trim().replace(/[\s\-()]/g, "");
  if (!s) return s;
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return `+${s.slice(2)}`;
  if (s.startsWith("254")) return `+${s}`;
  if (s.startsWith("0") && s.length >= 10) return `+254${s.slice(1)}`;
  if (/^7\d{8}$/.test(s)) return `+254${s}`;
  return s.startsWith("+") ? s : `+${s}`;
}

function toRecipientList(to) {
  if (Array.isArray(to)) {
    return to.map((n) => normalizePhoneNumber(n)).filter(Boolean);
  }
  const one = normalizePhoneNumber(to);
  return one ? [one] : [];
}

/**
 * Single HTTP call to Traccar (one recipient).
 * API: POST { "to": "+254...", "message": "..." }
 * Header: Authorization: <token>  (raw token, not Bearer)
 */
export async function sendTraccarSmsOnce(config, { to, message }) {
  const valid = validateTraccarConfig(config);
  if (!valid.valid) {
    throw new Error(valid.error);
  }

  const phone = normalizePhoneNumber(to);
  const text = String(message ?? "").trim();
  if (!phone) throw new Error("Recipient phone number is required");
  if (!text) throw new Error("Message body is required");

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    Authorization: config.apiKey,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs());

  try {
    const payload = { to: phone, message: text };
    if (config.senderId) {
      payload.from = config.senderId;
      payload.sender = config.senderId;
      payload.senderId = config.senderId;
    }

    const res = await fetch(config.gatewayUrl, {
      method: config.method || "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseText = await res.text();
    if (!res.ok) {
      throw new Error(
        `Traccar gateway HTTP ${res.status}: ${responseText || res.statusText}`
      );
    }

    let externalId = null;
    try {
      const data = JSON.parse(responseText);
      externalId = data?.id ?? data?.messageId ?? null;
    } catch (_) {
      externalId = `traccar-${Date.now()}`;
    }

    return { success: true, externalId, to: phone };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Traccar gateway timeout after ${getRequestTimeoutMs()}ms`);
    }
    if (err.cause?.code === "ECONNREFUSED" || err.cause?.code === "ENOTFOUND") {
      throw new Error(
        `Traccar gateway unreachable at ${config.gatewayUrl}. Check phone IP, app running, and same network/VPN.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Queue one or many recipients (3s apart by default).
 * Returns aggregated result; does not throw on partial failure.
 */
export async function sendTraccarSmsQueued(config, { to, message, body }) {
  const text = message ?? body;
  const recipients = toRecipientList(to);
  if (recipients.length === 0) {
    throw new Error("At least one recipient is required");
  }

  const queue = getSendQueue(config);
  const results = [];
  const errors = [];

  for (const phone of recipients) {
    const job = queue.add(async () => {
      try {
        const result = await sendTraccarSmsOnce(config, { to: phone, message: text });
        results.push(result);
        return result;
      } catch (err) {
        const failure = { success: false, to: phone, error: err.message || String(err) };
        errors.push(failure);
        console.error("[Traccar SMS] send failed:", phone, failure.error);
        return failure;
      }
    });
    await job;
  }

  if (results.length === 0 && errors.length > 0) {
    throw new Error(errors.map((e) => `${e.to}: ${e.error}`).join("; "));
  }

  return {
    success: errors.length === 0,
    externalId: results[0]?.externalId ?? null,
    sent: results.length,
    failed: errors.length,
    results,
    errors: errors.length ? errors : undefined,
  };
}

/** Immediate send (bypass queue) — use for admin tests only. */
export async function sendTraccarSms(config, payload) {
  const recipients = toRecipientList(payload.to);
  if (recipients.length === 1) {
    return sendTraccarSmsOnce(config, {
      to: recipients[0],
      message: payload.message ?? payload.body,
    });
  }
  return sendTraccarSmsQueued(config, payload);
}

export function getQueueStats(config) {
  const q = config ? getSendQueue(config) : null;
  return {
    pending: q?.pending ?? 0,
    size: q?.size ?? 0,
    intervalMs: getQueueIntervalMs(),
    gatewayUrl: config?.gatewayUrl ?? null,
  };
}
