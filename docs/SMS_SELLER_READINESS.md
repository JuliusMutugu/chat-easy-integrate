# SMS Seller Readiness Checklist

This project can support an SMS selling workflow, but production readiness depends on setup discipline.

Target commercial model example: **KES 0.30 per SMS unit** billed to downstream providers.

## 1) Platform Security (must pass)

- [x] Channel configuration endpoints require authenticated sessions.
- [x] Outbound channel send endpoints require authentication.
- [x] SMS sending requires a **Business** account with **KYC approved** status.
- [ ] Set a strong `SESSION_SECRET` in production (at least 32 random chars).
- [ ] Restrict `CLIENT_URL` and `SERVER_URL` to your real domains.

## 2) SMS Routing Setup (must pass)

- [ ] Configure:
  - `SMS_GATEWAY_URL`
  - optional `SMS_GATEWAY_API_KEY`
  - optional `SMS_GATEWAY_METHOD` (default `POST`)
- [ ] Connect your own SMPP/SS7/aggregator route behind `SMS_GATEWAY_URL`.
- [ ] Verify your sender ID/short code with local regulators and MNO interconnect partners.
- [ ] Send internal test messages to multiple carriers before launch.
- [ ] Set `SMS_SELL_RATE_KES=0.30` (or your desired wholesale rate).

## 3) Legal and Compliance (must pass)

- [ ] Ensure customer opt-in collection and storage before sending campaigns.
- [ ] Include opt-out instructions where required (for example STOP keywords).
- [ ] Publish privacy policy and SMS terms on your website.
- [ ] Confirm country-specific rules (time windows, content restrictions, sender identity rules).

## 4) Operational Readiness (recommended)

- [ ] Enable centralized logs and alerting for failed SMS sends.
- [ ] Define message templates for onboarding, follow-up, and re-engagement.
- [ ] Add dashboards for delivery rate, response rate, and conversion rate.
- [ ] Document incident playbook (provider outage, blocked sender, high failure rates).

## 5) Go-Live Smoke Test

1. Create a business user.
2. Submit KYC and set status to approved.
3. Configure SMS gateway credentials.
4. Send one test message via `POST /api/channels/sms/send`.
5. Confirm outbound message is recorded in `outbound_messages`.
6. Generate a quote via `POST /api/sms-reseller/quotes` and verify KES 0.30 pricing.

If all five pass, you are technically ready to begin SMS selling operations.
