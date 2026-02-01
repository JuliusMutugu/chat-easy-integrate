# 🌐 Production URL Configuration - Quick Guide

## The Problem
By default, your app might generate links like:
- ❌ `http://localhost:3000?invite=abc123`
- ❌ Email invites pointing to localhost
- ❌ CORS errors in production

## The Solution
Set these 2 environment variables in Render:

```bash
SERVER_URL=https://your-app-name.onrender.com
CLIENT_URL=https://your-app-name.onrender.com
```

## 📝 Step-by-Step

### 1. Get Your Render URL
After deploying, Render gives you a URL like:
```
https://nego-messaging.onrender.com
```
**Copy this URL!**

### 2. Add Environment Variables

Go to your Render service:

1. Click **"Environment"** tab
2. Click **"Add Environment Variable"**
3. Add:
   - **Key:** `SERVER_URL`
   - **Value:** `https://your-app-name.onrender.com` (your actual URL)
4. Click **"Add Environment Variable"** again
5. Add:
   - **Key:** `CLIENT_URL`
   - **Value:** `https://your-app-name.onrender.com` (same URL)
6. Click **"Save Changes"**

### 3. Wait for Redeploy
- Render will automatically redeploy (~2-3 minutes)
- Watch the logs to confirm success

### 4. Test It Works

✅ **Create a room and copy invite link:**
```
Good: https://your-app.onrender.com?invite=abc123
Bad:  http://localhost:3000?invite=abc123
```

✅ **Check browser console (F12):**
```
Good: WebSocket connected to wss://your-app.onrender.com
Bad:  WebSocket failed to connect to ws://localhost:3000
```

✅ **Send invite email (if configured):**
- Link should point to your Render URL, not localhost

## 🎯 What This Fixes

| Feature | Before | After |
|---------|--------|-------|
| Room invites | `localhost:3000?invite=...` | `your-app.onrender.com?invite=...` |
| Email links | Broken localhost links | Working production links |
| SMS links | Broken localhost links | Working production links |
| CORS | May fail | Works properly |
| WebSocket | May connect to localhost | Connects to production |
| Widget SDK | May fail | Works properly |

## 🔧 For Custom Domains

If you add a custom domain (e.g., `app.yourcompany.com`):

1. Add domain in Render (Settings → Custom Domains)
2. Update both variables:
   ```bash
   SERVER_URL=https://app.yourcompany.com
   CLIENT_URL=https://app.yourcompany.com
   ```
3. Save and redeploy

## ❓ FAQ

**Q: Why do I need both SERVER_URL and CLIENT_URL?**
A: They can be different if you have separate domains for API vs frontend. For most deployments, they're the same.

**Q: Can I skip this step?**
A: The app will work, but:
- Invite links will be broken (localhost)
- Email/SMS features won't work properly
- Widget SDK may fail
- CORS might cause issues

**Q: When should I set these?**
A: Right after your first deployment completes and you have a Render URL.

**Q: Do I use http or https?**
A: Always use `https://` for Render deployments (SSL is automatic).

**Q: What if I forget to do this?**
A: You can add them anytime. Just:
1. Add the variables
2. Save
3. Render auto-redeploys
4. All fixed! ✅

## ✅ Done!

Once configured, your app will:
- ✅ Generate correct production URLs
- ✅ Send valid invite links via email/SMS
- ✅ Handle CORS properly
- ✅ Connect WebSockets correctly
- ✅ Work with custom domains

**No more localhost in production!** 🎉

---

**Need more details?** See [PRODUCTION_URLS.md](./docs/PRODUCTION_URLS.md)
