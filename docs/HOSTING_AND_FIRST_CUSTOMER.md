# Host the Platform + Register First Customer (Imara Logic)

You host SMS delivery for customers. **They only need an API key** — you manage Traccar phones/gateways on your side.

---

## Part A — Deploy (Render recommended)

### 1. Push code to GitHub

```bash
git add .
git commit -m "SMS reseller API with managed gateway delivery"
git push origin main
```

### 2. Create Render Web Service

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** (uses `render.yaml`)
2. Or **Web Service** → connect repo → build: `npm install && npm run install:client && npm run build` → start: `npm start`

### 3. Environment variables (Render → Environment)

| Variable | Example | Required |
|----------|---------|----------|
| `NODE_ENV` | `production` | Yes |
| `SESSION_SECRET` | auto-generate | Yes |
| `SERVER_URL` | `https://your-app.onrender.com` | Yes |
| `CLIENT_URL` | `https://your-app.onrender.com` | Yes |
| `SMS_GATEWAY_PROVIDER` | `traccar` | Yes |
| `SMS_GATEWAY_URL` | your gateway URL | Yes |
| `SMS_GATEWAY_API_KEY` | Traccar token | Yes |
| `SMS_GATEWAY_METHOD` | `POST` | Yes |
| `SMS_GATEWAY_QUEUE_MS` | `3000` | Yes |
| `SMS_SELL_RATE_KES` | `0.30` | Yes |
| `DATABASE_PATH` | `/data/messaging.db` | Yes (with disk) |

### 4. Persistent disk (important)

SQLite resets on redeploy without disk:

1. Render → your service → **Disks** → Add disk  
   - Mount: `/data`  
   - Size: 1 GB+  
2. Set `DATABASE_PATH=/data/messaging.db`  
3. Redeploy  

### 5. Reach your Traccar phone from the cloud

Render runs in the cloud. Your phone at `192.168.x.x` is **not** public by default.

Pick one:

| Option | When to use |
|--------|-------------|
| **Tailscale** | Best: phone + server on same tailnet, use tailscale IP in `SMS_GATEWAY_URL` |
| **Cloudflare Tunnel** | Expose phone gateway securely |
| **Run API on same LAN** | Dev/small scale: server at home/office with phone |

Until this works, SMS sends from production will fail with "gateway unreachable".

---

## Part B — Register first customer (Imara Logic)

### 1. Onboard (managed — you host gateway)

```bash
node scripts/onboard-customer.mjs "Imara Logic" "tech@imaralogic.co.ke"
```

Copy the **API key** from output. Send Imara Logic:

- API base URL: your `SERVER_URL`
- API key (secret)
- PDF/markdown: `docs/SMS_CLIENT_API_INTEGRATION.md`

### 2. Optional: assign them a dedicated phone later

When you plug in a phone/SIM for Imara only:

```bash
node scripts/set-tenant-gateway.mjs <clientId> http://PHONE_IP:8082 TRACCAR_TOKEN
```

### 3. Approve your business account (one-time, for admin UI)

Register in the app as **Business**, then:

```bash
sqlite3 server/messaging.db \
  "UPDATE users SET kyc_status='approved' WHERE email='YOUR_EMAIL';"
```

### 4. Test customer API

```bash
SMS_TEST_API_KEY=sms_live_... SERVER_URL=https://your-app.onrender.com \
  node scripts/test-tenant-sms.mjs 2547XXXXXXXX
```

Expect `deliveryMode: "managed"` and `route: "managed"` in send response.

---

## Part C — What Imara Logic needs from you

| Item | You provide |
|------|-------------|
| API base URL | `https://your-app.onrender.com` |
| API key | From `onboard-customer.mjs` |
| Price | KES 0.30 / SMS |
| Integration doc | `docs/SMS_CLIENT_API_INTEGRATION.md` |
| Commercial proposal | `docs/SMS_CLIENT_PROPOSAL_IMARALOGIC.md` |

They do **not** need Traccar, phone IP, or gateway tokens.

---

## Part D — Go-live checklist

- [ ] Render deployed + health: `GET /api/health`
- [ ] Disk mounted for SQLite
- [ ] `SMS_GATEWAY_*` reaches phone (Tailscale/tunnel tested)
- [ ] Imara Logic onboarded + API key sent
- [ ] Pilot SMS delivered
- [ ] Prepaid invoice / agreement signed

---

## Quick commands reference

```bash
# Onboard customer
node scripts/onboard-customer.mjs "Company" email@company.com

# Assign dedicated gateway (optional)
node scripts/set-tenant-gateway.mjs <clientId> <url> <token>

# Test
SMS_TEST_API_KEY=... SERVER_URL=... node scripts/test-tenant-sms.mjs 0713558761
```
