# SMS Reseller API Spec (Client-Facing)

This is the document you share with organizations buying SMS from you.

## Base URL

`https://your-domain.com`

## Authentication

Use API key as bearer token:

`Authorization: Bearer <client-api-key>`

## Content Type

`Content-Type: application/json`

## 1) Send SMS

`POST /api/channels/sms/send`

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

## Environment Requirements (Provider Side)

```env
SMS_GATEWAY_URL=https://your-sms-router.example.com/send
SMS_GATEWAY_API_KEY=optional-token
SMS_GATEWAY_METHOD=POST
SMS_SELL_RATE_KES=0.30
```

## Operational Notes

- Client delivery depends on upstream route quality
- Keep unique client reference IDs in your own app for reconciliation
- For production onboarding, run a pilot first on all target networks
