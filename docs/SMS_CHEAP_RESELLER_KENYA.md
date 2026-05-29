# Cheap Kenya SMS Reseller — KES 0.30/SMS (No Twilio, No Africa's Talking)

Sell SMS SaaS at **~KES 0.30/unit** using Android phones as your first route. Upgrade to **local Kenyan wholesale SMPP** only when volume justifies it.

---

## 1. Cheapest stack

```
Customer app → this platform (API + billing) → Traccar SMS Gateway (Android) → Safaricom/Airtel
```

| Piece | Role | Cost |
|-------|------|------|
| **Android phone** (used, KES 3–8k) | Runs [Traccar SMS Gateway](https://www.traccar.org/sms/) | Amortize ~KES 50–150/mo over 12–24 mo |
| **Prepaid SIM** (Safaricom/Airtel) | Outbound route + From line | **KES 50–100/mo** line rental + per-SMS bundle |
| **This repo** | Multi-tenant API, prepaid wallet, routing | Your VPS (~KES 500–2k/mo) or Render free tier + disk |
| **Tailscale / tunnel** | Cloud server → phone on LAN | Free tier usually enough |

### Two tenant modes (pick per customer tier)

| Mode | Setup | Recipient sees | Good for |
|------|--------|----------------|----------|
| **Budget — shared SIM** | One phone, platform `SMS_GATEWAY_URL` | Same phone number for all; body prefixed `[BrandName]` | Pilots, low volume, price-sensitive |
| **Business — dedicated SIM** | One phone + SIM per tenant | That tenant's **unique number** on From line | SMBs who want their own line without CSP fees |

**Enterprise** (registered alphanumeric sender, e.g. `ImaraLogic`) needs a **local CSP / SMPP wholesaler** — not a phone. See §4–5.

> Prefix in the body does **not** change the From line. Shared SIM = shared number. Be honest in sales copy.

---

## 2. Cost model (why KES 0.30 works)

**Per SMS (phone route, rough):**

| Item | KES/SMS |
|------|--------:|
| Safaricom/Airtel prepaid SMS (bundle) | ~0.05–0.15 |
| SIM + phone amortized (10k SMS/mo, 1 shared phone) | ~0.01–0.02 |
| Server + ops buffer | ~0.02–0.05 |
| **Effective upstream** | **~0.10–0.22** |
| **Sell at** | **0.30** |
| **Gross margin** | **~0.08–0.20/SMS** |

**Fixed monthly (1 shared gateway phone):**

- SIM: KES 50–100  
- Power + data (Wi‑Fi): negligible if office/home  
- 1 phone serves many **Starter** tenants; add a phone per **Business** tenant  

**Break-even vs wholesale:** At **~50k+ SMS/month** on one route, local SMPP often lands **KES 0.08–0.18/SMS** with better throughput and DLRs — phones become the bottleneck (queue, one SIM, manual SIM swaps).

Use `docs/SMS_PROFIT_CALCULATOR_KENYA.md` for margin tables. Keep **≥5–10%** buffer for failures and retries.

---

## 3. 30-minute launch checklist

### Minute 0–10: Phone + `.env`

1. Install **Traccar SMS Gateway** on Android → enable **Local Service** → note `IP:port` and **token**.
2. Copy `env.example` → `.env`. Minimum:

```env
SESSION_SECRET=<32+ random chars>
SERVER_URL=http://localhost:3000          # or your public URL
CLIENT_URL=http://localhost:5173
NODE_ENV=development

SMS_GATEWAY_PROVIDER=traccar
SMS_GATEWAY_URL=http://192.168.x.x:8082   # Traccar IP:port
SMS_GATEWAY_API_KEY=<traccar-token>
SMS_GATEWAY_METHOD=POST
SMS_GATEWAY_QUEUE_MS=3000
SMS_GATEWAY_TIMEOUT_MS=15000
SMS_SELL_RATE_KES=0.30
```

3. **Scale cheap tier — multiple phones (no Twilio):**

```bash
node scripts/add-gateway-to-pool.mjs http://192.168.100.2:8082 TOKEN1 sim-a
node scripts/add-gateway-to-pool.mjs http://192.168.100.3:8082 TOKEN2 sim-b
# Paste printed SMS_GATEWAY_POOL line into .env
```

Each **Starter** tenant is pinned to one phone in the pool (hash by client id). Add phones as you sign clients — still ~KES 50–100/SIM/month.

4. Quick status: `node scripts/launch-reseller-30min.mjs`

5. Start app: `npm install && npm run dev` (or `npm start` in prod).
6. Production: mount SQLite disk (`DATABASE_PATH`), expose phones via **Tailscale** or **Cloudflare Tunnel** — cloud cannot reach `192.168.x.x` directly. See `docs/HOSTING_AND_FIRST_CUSTOMER.md`.

### Minute 10–20: Onboard first client

**Starter (shared phone, brand prefix):**

```bash
node scripts/onboard-customer.mjs "Acme Ltd" billing@acme.co.ke \
  --registered ACMEAlerts --brand "Acme Alerts"
```

**Business (dedicated phone from day one):**

```bash
node scripts/onboard-customer.mjs "Acme Ltd" billing@acme.co.ke \
  --registered ACMEAlerts --brand "Acme Alerts" \
  --gateway http://192.168.x.y:8082 --token THEIR_TRACCAR_TOKEN
```

Or assign later:

```bash
node scripts/set-tenant-gateway.mjs <clientId> http://PHONE_IP:8082 TRACCAR_TOKEN
```

Copy the printed **`sms_live_...` API key**. Send client `docs/SMS_CLIENT_API_INTEGRATION.md`.

### Minute 20–25: Admin one-time (UI sends)

Register as **Business** in the app, then approve KYC:

```bash
sqlite3 server/messaging.db \
  "UPDATE users SET kyc_status='approved' WHERE email='YOUR_EMAIL';"
```

### Minute 25–30: E2E test

```bash
SMS_TEST_API_KEY=sms_live_... SERVER_URL=http://localhost:3000 \
  node scripts/test-e2e-sms.mjs 2547XXXXXXXX
```

Expect:

- `deliveryMode: "managed"` (shared) or dedicated route if gateway set  
- `fromLineBehavior: "shared_sim"` or `"dedicated_sim"`  
- SMS on handset with `[Brand]` prefix on shared mode  

**Go/no-go:** `GET /api/health` OK, test SMS received, API key handed to client, prepaid terms agreed.

---

## 4. When to upgrade to local Kenyan wholesale SMPP

Stay on **Traccar phones** while:

- Combined volume **< ~20–50k SMS/month** per route  
- Throughput **< ~1 SMS every 3 s** (`SMS_GATEWAY_QUEUE_MS`) is acceptable  
- Clients accept **phone number** or **`[Brand]` prefix**, not registered alphanumeric From  

**Move to local SMPP** (Safaricom/Airtel interconnect via a **Kenyan CSP/wholesaler** — *not* Twilio or Africa's Talking) when:

| Signal | Why |
|--------|-----|
| **>50k SMS/mo** on one SIM | Bundles + queue latency hurt; SMPP unit cost drops |
| Client needs **registered sender ID** on From line | MNO rules: alphanumeric via approved aggregator only |
| Need **DLRs**, higher TPS, 24/7 SLA | Phones sleep, overheat, drop Wi‑Fi |
| Multiple **Enterprise** contracts | One SMPP bind + `SMS_AGGREGATOR_*` serves all tenants |

**Migration path:**

1. Sign a **local** wholesaler (SMPP or HTTP bridge to SMPP). Negotiate **KES 0.08–0.16/SMS** at volume; register sender IDs through them.  
2. Set in `.env`:

```env
SMS_AGGREGATOR_URL=https://your-csp-http-bridge/send
SMS_AGGREGATOR_API_KEY=...
SMS_AGGREGATOR_PROVIDER=aggregator
```

3. Keep per-tenant `sender_id` in DB — platform routes registered tenants to aggregator automatically (`docs/SMS_SAAS_SENDER_IDS.md`).  
4. Retire phones for those tenants; keep one phone as **failover** if you want.

**Do not use** Twilio or Africa's Talking for this model — their Kenya retail pricing (~KES 0.80–2.00+) destroys a **KES 0.30** resale unless you charge 1.00+.

---

## 5. Pricing tiers to sell

| Tier | Delivery | From line | Your COGS (typical) | Sell (suggested) |
|------|----------|-----------|---------------------|------------------|
| **Starter** | Shared Traccar + `[Brand]` prefix | Platform SIM number | ~KES 0.12–0.18/SMS | **KES 0.30/SMS** prepaid |
| **Business** | Dedicated Traccar + SIM per client | Client's own number | ~KES 0.15–0.22/SMS (+ KES 50–100/mo SIM) | **KES 0.35–0.45/SMS** or flat **KES 500/mo + 0.28/SMS** |
| **Enterprise** | Local CSP / SMPP + registered `sender_id` | `ImaraLogic`, `ACMEAlerts` (max 11 chars) | ~KES 0.10–0.18/SMS + CSP setup fee | **KES 0.40–0.60/SMS** + **KES 2k–10k/mo** platform minimum |

**Commercial defaults:**

- Prepaid wallet only at launch  
- Minimum top-up: KES 500 (Starter), KES 2,000 (Business), KES 10,000 (Enterprise)  
- Sender ID registration: 2–4 weeks via CSP — charge setup once  
- OTP/transactional vs marketing: stricter opt-in for campaigns; include STOP where required  

**Pitch one-liner:** *"API SMS from KES 0.30 — your brand in every message; upgrade to your own line or registered sender ID as you grow."*

---

## Quick reference

```bash
# Onboard
node scripts/onboard-customer.mjs "Co" email@co.ke --registered SenderID --brand "Display Name"

# Dedicated gateway
node scripts/set-tenant-gateway.mjs <clientId> http://IP:8082 TOKEN

# Update sender metadata
node scripts/set-tenant-sender.mjs --name "Co" --registered SenderID --brand "Display Name"

# Test
SMS_TEST_API_KEY=... SERVER_URL=... node scripts/test-e2e-sms.mjs 2547XXXXXXXX
```

| Doc | Use |
|-----|-----|
| `docs/HOSTING_AND_FIRST_CUSTOMER.md` | Deploy + Tailscale |
| `docs/SMS_SAAS_SENDER_IDS.md` | Shared vs dedicated vs registered |
| `docs/SMS_CLIENT_API_INTEGRATION.md` | Hand to developers |
| `docs/SMS_PROFIT_CALCULATOR_KENYA.md` | Margins at 0.30 |
