# Production URL Configuration

This guide explains how to configure URLs correctly for production deployment so that your app doesn't reference `localhost` in production.

## 🎯 Overview

The application uses environment variables to determine the correct URLs for different environments:

- **Development:** Uses `localhost:3000` (server) and `localhost:5173` (client dev server)
- **Production:** Uses your Render domain (e.g., `https://your-app.onrender.com`)

## 📋 Environment Variables

### Client-Side (Frontend)

The client automatically detects the correct URL using this logic:

```javascript
serverUrl: import.meta.env.VITE_SERVER_URL || window.location.origin
```

This means:
1. **If `VITE_SERVER_URL` is set:** Use that
2. **Otherwise:** Use `window.location.origin` (automatic in production!)

**✅ No configuration needed!** The client will automatically use the correct production URL.

### Server-Side (Backend)

The server needs two environment variables:

#### 1. `SERVER_URL` 
Used for:
- Generating invite links in emails/SMS
- Creating absolute URLs for resources
- Webhook callbacks

**Example:** `https://nego-messaging.onrender.com`

#### 2. `CLIENT_URL`
Used for:
- CORS configuration
- Redirects back to frontend
- Cross-origin authentication

**Example:** `https://nego-messaging.onrender.com`

> **Note:** In most cases, `SERVER_URL` and `CLIENT_URL` are the same (your Render domain).

## 🚀 Setting Up in Render

### Step 1: Deploy Without URL Variables

1. Deploy your app to Render first
2. Wait for deployment to complete
3. Note your app's URL: `https://your-app-name.onrender.com`

### Step 2: Add URL Environment Variables

1. Go to your Render service
2. Navigate to **"Environment"** tab
3. Click **"Add Environment Variable"**
4. Add these two variables:

   **Variable 1:**
   - **Key:** `SERVER_URL`
   - **Value:** `https://your-app-name.onrender.com` (replace with your actual URL)

   **Variable 2:**
   - **Key:** `CLIENT_URL`
   - **Value:** `https://your-app-name.onrender.com` (same as above)

5. Click **"Save Changes"**
6. Your app will automatically redeploy with correct URLs ✅

### Step 3: Verify

Test these features to ensure URLs are correct:

- ✅ Send invite email → Check link points to production URL
- ✅ Copy room invite link → Should be `https://your-app.onrender.com?invite=...`
- ✅ Socket.io connection → Should connect to production (check browser console)
- ✅ API calls → Should go to production (check Network tab)

## 🔍 Where URLs Are Used

### Automatically Handled (No Config Needed)

These work automatically in production:

1. **Socket.io connections** → Uses `config.serverUrl` which defaults to `window.location.origin`
2. **API fetch calls** → All use `config.serverUrl`
3. **Widget SDK** → Detects server from script tag or uses current origin
4. **Room invite links (UI copy)** → Uses `window.location.origin`

### Requires SERVER_URL Environment Variable

These need `SERVER_URL` set in Render:

1. **Email invite links** → Generated on server, sent via email
2. **SMS invite links** → Generated on server, sent via SMS
3. **Webhook URLs** → If you add webhook integrations later
4. **PDF invoice links** → Generated on server

## 🛠️ For Custom Domains

If you use a custom domain (e.g., `app.yourcompany.com`):

1. Add custom domain in Render (Settings → Custom Domains)
2. Update environment variables:
   ```
   SERVER_URL=https://app.yourcompany.com
   CLIENT_URL=https://app.yourcompany.com
   ```
3. Redeploy

## 📊 Environment Variable Summary

| Variable | Required | Purpose | Example |
|----------|----------|---------|---------|
| `SERVER_URL` | Yes* | Server-generated URLs (emails, SMS) | `https://your-app.onrender.com` |
| `CLIENT_URL` | Yes* | CORS, redirects | `https://your-app.onrender.com` |
| `VITE_SERVER_URL` | No | Client override (usually not needed) | `https://your-app.onrender.com` |

\* *Required for production, optional for development*

## 🐛 Troubleshooting

### Problem: Invite emails have localhost URLs

**Cause:** `SERVER_URL` not set

**Fix:**
```bash
# In Render Environment tab
SERVER_URL=https://your-app-name.onrender.com
```

### Problem: CORS errors in production

**Cause:** `CLIENT_URL` not set or incorrect

**Fix:**
```bash
# In Render Environment tab
CLIENT_URL=https://your-app-name.onrender.com
```

### Problem: Widget SDK not connecting

**Cause:** Widget trying to connect to localhost

**Fix:** Widget SDK auto-detects from script tag. Ensure integration code uses:
```html
<script src="https://your-app.onrender.com/sdk/nego.js"></script>
```

### Problem: Mixed content warnings (HTTP/HTTPS)

**Cause:** Some URLs using HTTP instead of HTTPS

**Fix:** Always use `https://` in production environment variables:
```bash
# Correct
SERVER_URL=https://your-app.onrender.com

# Wrong
SERVER_URL=http://your-app.onrender.com
```

## ✅ Quick Checklist

Before going live:

- [ ] Deploy to Render and get your URL
- [ ] Add `SERVER_URL` environment variable
- [ ] Add `CLIENT_URL` environment variable
- [ ] Redeploy (happens automatically)
- [ ] Test invite link generation
- [ ] Test real-time messaging
- [ ] Test API calls (check browser Network tab)
- [ ] Test any email/SMS features
- [ ] Verify no localhost references in logs

## 🎉 Success!

Once configured, your app will:
- ✅ Use production URLs everywhere
- ✅ Generate correct invite links
- ✅ Connect WebSockets to production
- ✅ Handle CORS properly
- ✅ Work with custom domains

No more localhost in production! 🚀

---

**Need help?** Check the [main deployment guide](./DEPLOYMENT.md) or Render logs for errors.
