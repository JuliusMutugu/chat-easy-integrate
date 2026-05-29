# SMS API Integration Guide (Client)

**For:** Imara Logic and other organizations integrating bulk SMS  
**Provider:** Your SMS platform  
**Pricing:** KES 0.30 per SMS unit (as agreed in contract)

---

## 1. Overview

This API lets you send SMS messages from your own systems (HR app, ERP, custom dashboard, scripts).

- **Protocol:** HTTPS + JSON
- **Auth:** API key (issued by your provider after onboarding)
- **Delivery:** Kenya mobile networks via provider routing
- **Throughput:** Messages are queued (~1 SMS every 3 seconds) for reliable delivery

---

## 2. Base URL

| Environment | Base URL |
|-------------|----------|
| Production | `https://YOUR-PROVIDER-DOMAIN.com` |
| Local test | `http://localhost:3000` |

Replace `YOUR-PROVIDER-DOMAIN.com` with the URL your provider gives you.

---

## 3. Delivery model (managed by your provider)

Your provider hosts SMS delivery infrastructure for you.

- You receive an **API key** and **base URL** only.
- You do **not** configure Traccar, phones, or gateways.
- Check status: `GET /api/v1/account` → `"deliveryMode": "managed"`

Some enterprise customers may later get a **dedicated** sender line (`deliveryMode: "dedicated"`) — still managed by the provider.

---

## 4. Authentication

Every request must include your **API key**.

**Option A (recommended)**

```http
Authorization: Bearer sms_live_xxxxxxxxxxxxxxxx
```

**Option B**

```http
X-API-Key: sms_live_xxxxxxxxxxxxxxxx
```

Store the key securely. Do not commit it to Git or expose it in frontend JavaScript.

---

## 5. Endpoints

### 5.1 Check account

`GET /api/v1/account`

**Response (200)**

```json
{
  "providerName": "Imara Logic",
  "status": "active",
  "sellRateKes": 0.3,
  "currency": "KES",
  "deliveryMode": "managed",
  "gatewayConfigured": false,
  "senderId": "ImaraLogic",
  "brandSenderName": "ImaraLogicSystems",
  "senderIdNote": "Your registered brand name vs network sender ID (Kenya 11-character limit).",
  "note": "SMS delivery is managed by your provider. Messages use your registered sender brand."
}
```

**Sender display on phones**

- Your account is configured with brand **`ImaraLogicSystems`** (stored in `brandSenderName`).
- On the mobile network, alphanumeric sender IDs are limited to **11 characters**, so traffic is sent as **`ImaraLogic`** (`senderId`).
- When delivery uses a **phone gateway** (Traccar + SIM), the **From** line on the recipient’s phone is usually your **SIM number**, or a **contact name they saved** for that number. That contact name is **not** set by this API.
- Outbound messages are prefixed with **`[ImaraLogicSystems]`** in the message body so the brand is visible in the notification preview. Set `SMS_BRAND_PREFIX=0` on the provider server to disable the prefix.
- For the **From** line to show a company name instead of a number, register an alphanumeric sender ID with Safaricom/Airtel (via your SMS aggregator or CSP).

### 5.2 Send SMS

`POST /api/v1/sms/send`

**Headers**

```http
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | string or string[] | Yes | Recipient(s). Use `2547XXXXXXXX` or `+2547XXXXXXXX` |
| `body` | string | Yes* | Message text |
| `message` | string | Yes* | Alias for `body` |

\* One of `body` or `message` is required.

**Example – single recipient**

```json
{
  "to": "254713558761",
  "body": "Imara Logic: Staff meeting at 9:00 AM today."
}
```

**Example – multiple recipients**

```json
{
  "to": ["254713558761", "254712345678"],
  "body": "Imara Logic alert: System maintenance tonight 11 PM."
}
```

**Success response (200)**

```json
{
  "success": true,
  "externalId": "traccar-1780011375939",
  "sent": 2,
  "failed": 0,
  "clientId": "src-...",
  "providerName": "Imara Logic"
}
```

**Error responses**

| HTTP | Meaning |
|------|---------|
| 400 | Missing `to` or message body |
| 401 | Invalid or missing API key |
| 403 | Account suspended |
| 503 | Provider gateway not configured |
| 500 | Send failed (gateway unreachable, etc.) |

```json
{
  "error": "Invalid API key"
}
```

---

## 5. Phone number format (Kenya)

| You send | Normalized |
|----------|------------|
| `0713558761` | `+254713558761` |
| `254713558761` | `+254713558761` |
| `+254713558761` | `+254713558761` |

Prefer international format without spaces: `254713558761`.

---

## 6. Code examples

### cURL

```bash
curl -X POST "https://YOUR-PROVIDER-DOMAIN.com/api/v1/sms/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "to": "254713558761",
    "body": "Test message from Imara Logic integration."
  }'
```

### JavaScript (Node.js)

```javascript
const BASE = "https://YOUR-PROVIDER-DOMAIN.com";
const API_KEY = process.env.SMS_API_KEY;

async function sendSms(to, body) {
  const res = await fetch(`${BASE}/api/v1/sms/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ to, body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

await sendSms("254713558761", "Hello from Imara Logic");
```

### PHP

```php
$ch = curl_init("https://YOUR-PROVIDER-DOMAIN.com/api/v1/sms/send");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Content-Type: application/json",
    "Authorization: Bearer " . getenv("SMS_API_KEY"),
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "to" => "254713558761",
    "body" => "Hello from Imara Logic",
  ]),
]);
$response = curl_exec($ch);
curl_close($ch);
```

### Python

```python
import os, requests

r = requests.post(
    "https://YOUR-PROVIDER-DOMAIN.com/api/v1/sms/send",
    headers={"Authorization": f"Bearer {os.environ['SMS_API_KEY']}"},
    json={"to": "254713558761", "body": "Hello from Imara Logic"},
    timeout=30,
)
r.raise_for_status()
print(r.json())
```

---

## 7. Integration checklist

- [ ] Receive API key from provider (one-time, keep secret)
- [ ] Confirm production base URL
- [ ] Call `GET /api/v1/account` — expect `status: "active"`
- [ ] Send test SMS to 2–3 numbers on different networks
- [ ] Confirm messages received on handsets
- [ ] Implement error handling and retries (do not retry 401/403)
- [ ] Agree prepaid billing / volume reporting with provider

---

## 8. Best practices

1. **Consent** — Only message users who opted in.
2. **Opt-out** — Include STOP instructions for marketing where required.
3. **Length** — Keep under 160 characters when possible (1 SMS unit).
4. **Long SMS** — Long text may count as multiple units; confirm billing with provider.
5. **Rate** — Avoid bursting thousands of requests per second; API queues automatically.
6. **Idempotency** — Use your own `referenceId` in your DB; the API returns `externalId` for reconciliation.

---

## 9. Support

| Item | Contact |
|------|---------|
| Technical issues | [provider support email/phone] |
| Billing | [billing contact] |
| API key rotation | Request new key from provider |

---

## 10. Onboarding flow (provider + client)

1. Client signs commercial agreement (KES 0.30/SMS).
2. Provider creates client account and issues **API key**.
3. Client runs tests from Section 7.
4. Client goes live on production base URL.

---

*Document version: 1.0 — share PDF or this file with Imara Logic engineering team.*
