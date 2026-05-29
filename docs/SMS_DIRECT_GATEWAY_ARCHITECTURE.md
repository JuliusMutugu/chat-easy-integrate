# Direct gateway architecture — distributor, not reseller-of-resellers

You are building a **global SMS distribution platform**: your software sits on top of **gateways** (radio/SMSC pipes), not on top of another company’s bulk-SMS SaaS product.

**Do not:** buy “bulk SMS” from a vendor who sells the same thing you sell (API + sender IDs + dashboard to businesses). That is retail stacked on retail.

**Do:** own routing, billing, tenant isolation, and connect each market to a **gateway** you control or contract at **interconnect** level.

---

## What “gateway only” means

| Layer | Who | Your role |
|-------|-----|-----------|
| **Business customer** | Imara Logic, etc. | You sell API + sender ID + support |
| **Your platform** | This repo | Multi-tenant routing, keys, rates, compliance hooks |
| **Gateway** | **You connect here** | Sends/receives SMS on the network |
| **Mobile network** | Safaricom, Airtel, Verizon, … | Last mile to the handset |

The gateway is **not** a marketing website that resells SMS. It is one of:

1. **GSM/ LTE radio** — SIM + modem/phone (Traccar, Kannel + Gammu, commercial SIM boxes)  
2. **SMSC / SMPP session** — your server binds to an operator or international SMS hub as **SMPP client** (you operate the bind, not a retail API wrapper)  
3. **SS7 / SIGTRAN** — carrier-grade (license, capex; long-term global play)

Your product is the **control plane**. The **data plane** is whatever gateway you plug in per region.

---

## Architecture (global distributor)

```
                    ┌─────────────────────────────────────┐
                    │  Your platform (this repo)          │
                    │  • Tenant API keys                  │
                    │  • Per-tenant sender_id             │
                    │  • Routing rules per country/MNO    │
                    │  • Billing / prepaid wallet         │
                    └──────────────┬──────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
   ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
   │ Gateway KE   │        │ Gateway NG   │        │ Gateway US   │
   │ Traccar pool │        │ SMPP bind    │        │ SMPP / SIM   │
   │ or Kannel    │        │ (your VPS)   │        │ farm         │
   └──────┬───────┘        └──────┬───────┘        └──────┬───────┘
          │                       │                       │
          ▼                       ▼                       ▼
      Safaricom /              MTN / etc.              AT&T / etc.
      Airtel KE
```

- **One codebase**, many **gateway adapters** (already: Traccar HTTP, generic HTTP, pool).  
- **Per country:** add a gateway row (URL/SMPP endpoint), not a new “SMS company” dependency.  
- **Per tenant:** `sender_id` + optional dedicated gateway (SIM or SMPP account split).

---

## What you run today (already “direct”, no Twilio)

| Piece | Gateway type | Competing with retail bulk SMS? |
|-------|----------------|----------------------------------|
| Android + Traccar | Radio (your SIM) | **No** — you pay the MNO prepaid, you own the pipe |
| `SMS_GATEWAY_POOL` | Multiple radios | **No** — same |
| Future `SMPP_GATEWAY_*` | Your Kannel/Jasmin → **operator interconnect** | **No** — if bind is **your** contract with MNO/Carrier, not a retail API |

Retail bulk SMS vendors = they already sell dashboard + API + sender ID to SMEs. **Skip them.**

Interconnect / MNO / international **hub** (infrastructure) = acceptable “gateway” if the contract is **wholesale transport**, not “resell their product under your brand.”

---

## Phased path (distributor globally)

### Phase 1 — Radio gateways (now, cheapest)

- Phones or GSM modems per country/market you serve.  
- Platform routes tenant → phone (dedicated or pool).  
- **You are the distributor:** MNO prepaid ↔ your API.  
- Limit: national, throughput, numeric sender (SIM number).

### Phase 2 — Your own SMPP client (per country)

- Deploy **Kannel** or **Jasmin SMS** on your VPS.  
- **You** hold the SMPP account with Safaricom (or a **carrier interconnect**, not a retail SMS website).  
- Platform env points at **your** Kannel HTTP/SMPP bridge:

```env
# Your infrastructure — not a competitor's SaaS
SMPP_GATEWAY_URL=http://127.0.0.1:13013/cgi-bin/sendsms
SMPP_GATEWAY_PROVIDER=aggregator
```

- Register alphanumeric sender IDs **in your name** with each MNO; assign `sender_id` per tenant in DB.

### Phase 3 — Multi-region routing table

- `sms_gateways` table: `country`, `mcc_mnc`, `gateway_url`, `credentials`, `cost_kes`.  
- Route `to` number prefix → correct gateway.  
- Same tenant API worldwide; backends differ by destination.

### Phase 4 — Licenses where required

- Kenya: CAK / operator KYC for high-volume A2P.  
- EU/US: 10DLC, DLT (India), etc. per market.  
- Compliance is per **country gateway**, not one global “SMS API vendor.”

---

## Platform mapping (this repo)

| Env / feature | Role |
|---------------|------|
| `SMS_GATEWAY_URL` / `SMS_GATEWAY_POOL` | **Your** radio gateways |
| `SMPP_GATEWAY_URL` (rename from aggregator) | **Your** SMPP bridge (Kannel/Jasmin you operate) |
| `sender_id` per tenant | Alphanumeric ID you registered with MNO |
| Dedicated `gateway_url` per tenant | Dedicated SIM or SMPP sub-account |
| `POST /api/v1/sms/send` | What global customers call |

Avoid naming or docs that say “buy from bulk SMS provider X.” Say **“attach gateway for region KE.”**

---

## Mental model

- **Distributor:** owns routing + commercial relationship to transport.  
- **Retail SMS SaaS competitor:** sells the same bundle you sell to Imara Logic — **never your upstream.**  
- **MNO / interconnect:** the only unavoidable upstream for true scale and alphanumeric senders.

You are not avoiding “other people” — you are avoiding **other product companies** and connecting only to **gateways** (radio or SMPP you control).

See also: `docs/SMS_CHEAP_RESELLER_KENYA.md` (Phase 1), `docs/SMS_SAAS_SENDER_IDS.md` (per-tenant sender IDs).
