# SMPP setup for your SMS SaaS (customers keep their number)

Your platform already sends like this when `SMPP_GATEWAY_URL` is set:

```http
POST {SMPP_GATEWAY_URL}
Content-Type: application/json

{
  "to": "+254713558761",
  "body": "Hello",
  "from": "+254717348043"
}
```

`from` = tenant `originator_phone` (customer's number). Customer installs **nothing**.

---

## The stack (3 layers)

```
Customer API  →  YOUR Node app  →  Kannel (HTTP)  →  SMPP  →  Safaricom/Airtel  →  phone
```

| Layer | You do |
|-------|--------|
| 1. **SMPP account** | Contract with MNO or **SMS interconnect** (wholesale transport, not a retail bulk-SMS website) |
| 2. **Kannel** | Run on your VPS; converts HTTP → SMPP |
| 3. **This repo** | `SMPP_GATEWAY_URL` points at Kannel |

---

## Step 1 — Get SMPP credentials (Kenya / global)

You need from a carrier or interconnect partner:

- `host` (e.g. `smpp.safaricom.co.ke` — example only, use what they give you)
- `port` (often `2775` or `2776` for TLS)
- `system_id` / username
- `password`
- Allowed **sender addresses** (each customer MSISDN or alphanumeric ID you register)

**What to ask for:** *"Wholesale SMPP bind for A2P SMS — I operate my own platform and need to set variable originating addresses per client."*

**Kenya paths (research and call):**

- Safaricom / Airtel **enterprise messaging** or authorized **CSPs** (Content Service Providers)
- International **SMS hubs** with Kenya routes (for multi-country later)

Avoid signing up as a reseller of another company's **dashboard + API product** — you want **SMPP transport**, not their SaaS.

---

## Step 2 — Install Kannel on your server (Ubuntu VPS)

```bash
sudo apt update
sudo apt install -y kannel
# or Docker: https://hub.docker.com/r/bastiaan/kannel
```

Kannel runs two parts:

- **bearerbox** — speaks SMPP to the operator  
- **smsbox** — accepts sends from your app via HTTP  

---

## Step 3 — Minimal Kannel config

Edit `/etc/kannel/kannel.conf` (paths vary). **Use values from your operator**, not these placeholders:

```ini
group = core
admin-port = 13000
smsbox-port = 13001
admin-password = changeme

group = smsc
smsc = smpp
smsc-id = SAFARICOM
host = SMPP_HOST_FROM_OPERATOR
port = 2775
smsc-username = YOUR_SYSTEM_ID
smsc-password = YOUR_PASSWORD
system-type = ""
interface-version = 0x34
source-addr-ton = 1
source-addr-npi = 1
dest-addr-ton = 1
dest-addr-npi = 1

group = smsbox
smsbox-id = LOCAL
bearerbox-host = 127.0.0.1
sendsms-port = 13013

group = sendsms-user
username = platform
password = platform-secret
default-sender = ""
```

Start:

```bash
sudo systemctl start kannel
curl "http://127.0.0.1:13013/cgi-bin/sendsms?username=platform&password=platform-secret&to=254713558761&from=254717348043&text=test"
```

If that curl delivers an SMS with **From = customer's number**, Kannel + operator are correct.

---

## Step 4 — Wire this repo

In `.env` on the **same machine** as Kannel (or reachable network):

```env
SMS_DEV_SIMULATE=0

SMPP_GATEWAY_URL=http://127.0.0.1:13013/cgi-bin/sendsms
SMPP_GATEWAY_PROVIDER=smpp
SMPP_GATEWAY_FORMAT=kannel
SMPP_KANNEL_USER=platform
SMPP_KANNEL_PASSWORD=platform-secret
```

Onboard tenant (no app for them):

```bash
node scripts/onboard-customer.mjs "Customer Name" email@co.ke --phone 0717348043
```

Test:

```bash
SMS_TEST_API_KEY=sms_live_... SERVER_URL=http://localhost:3001 \
  node scripts/test-e2e-sms.mjs 0713558761
```

Expect `route: tenant_smpp` and SMS on the handset **from 0717348043**.

---

## Step 5 — Register each customer's number

Before `from=254717348043` works, the **operator must allow** that originator on your SMPP account. Per tenant:

1. Submit KYC / use case to your interconnect partner  
2. Whitelist `+254717348043` (or alphanumeric `ImaraLogic`)  
3. Store same value in DB as `originator_phone` when onboarding  

Without whitelisting, SMPP accepts the bind but rejects or rewrites the sender.

---

## JSON gateway instead of Kannel

If your interconnect gives a **REST API** (JSON `to` / `from` / `body`), skip Kannel:

```env
SMPP_GATEWAY_URL=https://gateway.partner.com/v1/send
SMPP_GATEWAY_API_KEY=their-api-key
SMPP_GATEWAY_PROVIDER=smpp
# omit SMPP_GATEWAY_FORMAT (defaults to JSON)
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `canSend: false` | Set `SMPP_GATEWAY_URL`, `SMS_DEV_SIMULATE=0` |
| SMPP bind fails | Wrong host/port/credentials; firewall outbound 2775 |
| SMS sends but wrong From | Originator not registered with MNO |
| HTTP 401 to Kannel | Check `SMPP_KANNEL_USER` / `PASSWORD` |
| Works from curl, not app | `SMPP_GATEWAY_FORMAT=kannel` must be set |

---

## Cost ballpark (Kenya wholesale)

Negotiate **KES 0.08–0.18/SMS** at volume + setup fee. You sell at **0.30** — margin after Kannel/VPS is your business.

---

## What you do **not** need

- Traccar on customer phones  
- Twilio / retail bulk-SMS SaaS as your upstream product  
- Your personal SIM for tenant traffic  

You need: **SMPP bind + Kannel (or partner HTTP) + this platform.**
