# Commercial Proposal - Imara Logic

Date: [Insert date]  
Prepared for: `https://imaralogic.co.ke`

## 1. Offer

We provide bulk SMS delivery for organizational communications in Kenya, routed through our managed API. You integrate once; we handle delivery infrastructure.

- Use cases: staff notices, internal alerts, reminders, workflow notifications
- Delivery model: API-based integration (`POST /api/v1/sms/send`)
- Pricing: **tiered prepaid wallet** (see Section 3)

## 2. Scope of Service

- Outbound SMS API access
- Message acceptance and queueing
- Technical onboarding support
- Delivery status tracking (where upstream route supports DLR)
- Registered sender ID on managed routes (where applicable)

## 3. Pricing Tiers (cheap phone reseller model)

All tiers bill in **KES per SMS unit** (160-character GSM segment). Prepaid wallet; traffic stops when balance is zero.

| Tier | Best for | Price (KES/SMS) | Min top-up (KES) | Monthly volume | Gateway |
| --- | --- | ---: | ---: | --- | --- |
| **Starter** | Pilots, low-volume alerts | **0.35** | 500 | up to 5,000 SMS | Shared managed phone pool |
| **Business** | Production apps, HR/comms | **0.30** | 2,000 | up to 50,000 SMS | Shared pool + registered sender ID |
| **Enterprise** | High volume, dedicated SIM | **0.25** | 10,000 | 50,000+ SMS (custom) | Dedicated Traccar phone / custom route |

**Notes**

- Starter and Business use our platform phones (cost-efficient local routing); your brand appears in the message body prefix on shared routes.
- Enterprise includes a dedicated gateway (your own SIM/number on the From line) or aggregator-registered sender ID where available.
- Volume above Enterprise caps: custom quote (e.g. KES 0.22–0.24 at 200k+ units/month).
- Our upstream target cost on own-SIM routes is well below retail; tiers preserve margin for ops and delivery retries.

**Recommended for Imara Logic:** **Business** at **KES 0.30/SMS** unless monthly volume exceeds 50k units, then **Enterprise**.

## 4. Commercial Terms

- Currency: KES
- Billing: prepaid wallet per tier minimum top-up
- Taxes: [state VAT included/excluded]
- Payment terms: [e.g., upfront before traffic]
- Rate locked for contract term; tier upgrades on written notice

## 5. Integration Inputs Required from Client

1. Legal company name and billing contact
2. Preferred tier (Starter / Business / Enterprise)
3. Use-case category (transactional, alerts, OTP, campaign)
4. Estimated monthly volume
5. Peak throughput (SMS/minute)
6. Preferred sender ID (Business/Enterprise)
7. DLR requirement (yes/no)

## 6. Compliance Expectations

- Client must send only to users with valid consent/opt-in
- Opt-out handling must be implemented where applicable
- Prohibited content categories are not allowed
- Sender identity must follow Kenya telecom rules

## 7. Pilot and Go-Live Plan

1. Technical kickoff call
2. Share test API key and endpoint
3. Share integration guide: `docs/SMS_CLIENT_API_INTEGRATION.md`
4. Run pilot to multi-network sample numbers
5. Validate delivery and content compliance
6. Switch to production key and full traffic

**API summary for engineering**

- `GET /api/v1/account` — verify connection
- `POST /api/v1/sms/send` — send SMS (`to`, `body`)
- Auth: `Authorization: Bearer <api_key>`

## 8. SLA and Support

| Tier | Support | Incident response |
| --- | --- | --- |
| Starter | Email | Best effort (next business day) |
| Business | Email + chat | [e.g., 4 business hours] |
| Enterprise | Named contact | [e.g., 1 hour] |

Planned maintenance communication: [e.g., 24-hour notice]

## 9. Validity

This quote is valid for [X] days from issue date.
