/**
 * Multi-phone Traccar pool for cheap reseller SaaS (shared SIMs, sticky per tenant).
 *
 * Env:
 *   SMS_GATEWAY_POOL          JSON array or newline "url|apiKey|label" entries
 *   SMS_GATEWAY_POOL_STRATEGY   hash (default) | round_robin
 *   SMS_GATEWAY_URL / SMS_GATEWAY_API_KEY  — single-phone fallback when pool unset
 */

import crypto from "crypto";

function stripEnvQuotes(val) {
  if (val == null || typeof val !== "string") return val;
  const s = val.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const gatewayUrl = String(raw.url ?? raw.gatewayUrl ?? "").trim().replace(/\/$/, "");
  const apiKey = String(raw.apiKey ?? raw.api_key ?? "").trim();
  if (!gatewayUrl || !apiKey) return null;
  const label = raw.label ?? raw.name ?? null;
  return {
    gatewayUrl,
    apiKey,
    label: label ? String(label).trim() : null,
  };
}

function parsePoolEnv(raw) {
  const text = stripEnvQuotes(String(raw ?? "")).trim();
  if (!text) return [];

  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.map(normalizeEntry).filter(Boolean);
    } catch (_) {
      // fall through to line format
    }
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [url, apiKey, label] = line.split("|").map((p) => p.trim());
      return normalizeEntry({ url, apiKey, label: label || null });
    })
    .filter(Boolean);
}

let cachedPool = undefined;

/** @returns {{ gatewayUrl: string, apiKey: string, label: string|null }[]} */
export function getGatewayPool() {
  if (cachedPool !== undefined) return cachedPool;

  const fromPool = parsePoolEnv(process.env.SMS_GATEWAY_POOL);
  if (fromPool.length > 0) {
    cachedPool = fromPool;
    return cachedPool;
  }

  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  const apiKey = process.env.SMS_GATEWAY_API_KEY;
  if (gatewayUrl && apiKey) {
    const entry = normalizeEntry({
      url: stripEnvQuotes(String(gatewayUrl)),
      apiKey: stripEnvQuotes(String(apiKey)),
      label: "default",
    });
    cachedPool = entry ? [entry] : [];
    return cachedPool;
  }

  cachedPool = [];
  return cachedPool;
}

function getPoolStrategy() {
  const s = String(process.env.SMS_GATEWAY_POOL_STRATEGY || "hash").trim().toLowerCase();
  return s === "round_robin" || s === "round-robin" ? "round_robin" : "hash";
}

function hashClientToIndex(clientId, poolSize) {
  const hash = crypto.createHash("sha256").update(String(clientId)).digest();
  return hash.readUInt32BE(0) % poolSize;
}

let roundRobinCounter = 0;

function nextRoundRobinIndex(poolSize) {
  const idx = roundRobinCounter % poolSize;
  roundRobinCounter += 1;
  return idx;
}

/**
 * Pick a gateway from the pool for a tenant (sticky hash) or round-robin.
 * @returns {{ gatewayUrl: string, apiKey: string, label: string|null, poolIndex: number } | null}
 */
export function pickGatewayFromPool(tenantClientId = null) {
  const pool = getGatewayPool();
  if (pool.length === 0) return null;

  const strategy =
    tenantClientId && getPoolStrategy() === "hash" ? "hash" : "round_robin";
  const poolIndex =
    strategy === "hash" && tenantClientId
      ? hashClientToIndex(tenantClientId, pool.length)
      : nextRoundRobinIndex(pool.length);

  const entry = pool[poolIndex];
  return { ...entry, poolIndex };
}

/** Build full SMS config merged with platform defaults (method, provider). */
export function buildPooledSmsConfig(tenantClientId = null, overrides = {}) {
  const picked = pickGatewayFromPool(tenantClientId);
  if (!picked) return null;

  const method = (
    overrides.method ??
    process.env.SMS_GATEWAY_METHOD ??
    "POST"
  ).toUpperCase();
  const provider = (
    overrides.provider ??
    process.env.SMS_GATEWAY_PROVIDER ??
    "traccar"
  ).toLowerCase();

  return {
    gatewayUrl: picked.gatewayUrl,
    apiKey: picked.apiKey,
    method,
    provider,
    poolIndex: picked.poolIndex,
    poolLabel: picked.label,
  };
}
