# SaaS SMS — one sender ID per customer

## The problem you saw (“wme” on every message)

When all tenants share **one Traccar phone / one SIM**, recipients always see the **same phone number** on the From line. If someone saved that number as **“wme”** in their contacts, **every** tenant’s messages look like they came from “wme”.

A `[Brand]` prefix in the message body does **not** change the From line.

## How this platform models SaaS

| Field | Meaning |
|--------|---------|
| `registered_sender_id` (DB: `sender_id`) | **Unique per customer**, max 11 characters (Kenya MNO rule). Example: `ImaraLogic`, `ACMEAlerts`. |
| `brand_sender_name` | Long marketing name; used in `[prefix]` only on **phone** gateways. |

Each customer is onboarded with **their own** `sender_id`. They are never mapped to a shared abbreviation.

## Three delivery modes

### 1. Registered sender (recommended for SaaS)

Set on the server:

```env
SMS_AGGREGATOR_URL=https://your-sms-provider.com/send
SMS_AGGREGATOR_API_KEY=your-key
SMS_AGGREGATOR_PROVIDER=aggregator
```

When a tenant has `sender_id` set, sends use the **aggregator** with **that tenant’s** `from` / `senderId` field. Recipients see **ImaraLogic**, **ACMEAlerts**, etc. — not “wme”.

Register each `sender_id` with Safaricom/Airtel (via your CSP) before production traffic.

### 2. Dedicated phone per tenant

`PATCH /api/sms-reseller/clients/:id/gateway` with that customer’s Traccar URL + token.

Each tenant’s **SIM number** is their From line (different number per customer).

### 3. Shared phone (dev / low volume only)

Platform `SMS_GATEWAY_URL` (one Traccar). **All tenants share the same From line.** Only the `[Brand]` prefix differs.

Use for testing, not for selling “your own sender ID” to clients.

## Admin commands

```bash
# Imara Logic
node scripts/set-tenant-sender.mjs --name "Imara Logic" \
  --registered ImaraLogic --brand ImaraLogicSystems

# Another customer
node scripts/onboard-customer.mjs "Acme Corp" billing@acme.co.ke \
  --registered ACMEAlerts --brand ACMEAlerts
```

## API: what clients see

`GET /api/v1/account` returns:

- `registeredSenderId` — their unique ID  
- `fromLineBehavior` — `registered_sender_id` | `shared_sim` | `dedicated_sim`  
- `senderIdSharedWithOtherTenants` — `true` only on shared phone mode  

## Summary

| You want | You need |
|----------|----------|
| Each client’s name on the From line | `SMS_AGGREGATOR_URL` + registered `sender_id` per tenant |
| Cheap local routing, unique numbers | Dedicated Traccar phone per tenant |
| Quick dev test | Shared Traccar (same From for everyone) |
