# SMS Reseller API Spec (Quick Reference)

**Full integration guide for clients:** [SMS_CLIENT_API_INTEGRATION.md](./SMS_CLIENT_API_INTEGRATION.md)

## Base URL

`https://your-domain.com`

## Authentication

`Authorization: Bearer <client-api-key>`

## Client endpoints (share with buyers)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/account` | Verify API key and account status |
| POST | `/api/v1/sms/send` | Send SMS |

## 1) Send SMS

`POST /api/v1/sms/send`

### Request Body

```json
{
  "to": ["2547XXXXXXXX", "2547YYYYYYYY"],
  "body": "Team update: meeting starts at 9:00 AM."
}
```

- `to`: string or array of recipient numbers
- `body`: message content

### Success Response

```json
{
  "success": true,
  "externalId": "msg-12345"
}
```

### Error Response

```json
{
  "error": "SMS not configured. Set SMS gateway URL in Integrations or SMS_GATEWAY_URL in .env"
}
```

## Number Format

- Use international format: `2547XXXXXXXX`
- No spaces or separators

## Recommended Sending Rules

- Keep to 160 GSM-7 chars where possible
- Avoid prohibited content
- Send only to consented recipients
- Implement rate limiting on client side for large bursts

## Environment Requirements (Provider Side – Traccar)

```env
SMS_GATEWAY_PROVIDER=traccar
SMS_GATEWAY_URL=http://192.168.1.50:8082
SMS_GATEWAY_API_KEY=token-from-traccar-app
SMS_GATEWAY_METHOD=POST
SMS_GATEWAY_QUEUE_MS=3000
SMS_SELL_RATE_KES=0.30
```

Traccar expects `Authorization: <token>` (not Bearer) and JSON body `{ "to": "+254...", "message": "..." }`.
Messages are queued one at a time with a 3-second gap by default.

## Operational Notes

- Client delivery depends on upstream route quality
- Keep unique client reference IDs in your own app for reconciliation
- For production onboarding, run a pilot first on all target networks
