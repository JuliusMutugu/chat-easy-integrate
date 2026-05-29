# Global SMS SaaS — you host the gateway, they use their number

## Model

| Party | Role |
|-------|------|
| **You** | API server + **your** SMSC gateway (SMPP/Kannel/MNO HTTP) |
| **Customer** | API key only — **no Traccar, no app** |
| **Recipient** | Sees **customer's number** `+254717348043` as From |

You register each customer's MSISDN on **your** operator bind. Platform sets `from: +254717348043` on every send.

## Onboard

```bash
node scripts/onboard-customer.mjs "Customer Name" email@co.ke --phone 0717348043
```

## Your `.env`

```env
SERVER_URL=http://localhost:3001
SESSION_SECRET=<random>

# Production — your direct gateway to the mobile network
SMPP_GATEWAY_URL=http://your-kannel:13013/cgi-bin/sendsms
SMPP_GATEWAY_PROVIDER=smpp

# Dev — API flow test without real SMS (no delivery to handset)
SMS_DEV_SIMULATE=1
```

Do **not** require `SMS_GATEWAY_URL` (Traccar) for paying tenants.

## Test send

```bash
SMS_TEST_API_KEY=sms_live_... SERVER_URL=http://localhost:3001 \
  node scripts/test-e2e-sms.mjs 0713558761
```

With `SMS_DEV_SIMULATE=1`: API returns success + `from: +254717348043` in logs — **no real SMS** until `SMPP_GATEWAY_URL` is live.

## Production

1. Operate SMPP bind with MNO / international SMSC.  
2. Register each tenant `originator_phone` with the operator.  
3. Customer calls `POST /api/v1/sms/send` — your gateway sends with **their** From address.
