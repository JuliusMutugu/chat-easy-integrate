# Bulk SMS platform — current state

## What works today

- Onboard tenant: `node scripts/onboard-customer.mjs "Name" email@x.com --phone 0712345678`
- Client API: `GET /api/v1/account`, `POST /api/v1/sms/send`
- Each tenant has `originator_phone` (their MSISDN on the From line when SMPP is live)
- Multi-operator env: `SMPP_GATEWAY_SAFARICOM_URL`, `SMPP_GATEWAY_AIRTEL_URL`, etc.

## What is required for real SMS

1. `SMPP_GATEWAY_*` in `.env` (your Kannel/MNO bridge on **your** server)
2. Register each tenant number with your operator
3. `node scripts/verify-platform.mjs` — all PASS

Tenant traffic does **not** use your personal Traccar/SIM.

## Verify

```bash
npm start
node scripts/verify-platform.mjs
```

See `docs/SMPP_SETUP_GUIDE.md` for Kannel wiring.
