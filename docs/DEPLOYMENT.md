# Deployment Guide - Render

This guide will walk you through deploying the Nego Messaging Platform on Render.

## Prerequisites

1. A [Render](https://render.com) account
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. API keys for third-party services (optional but recommended)

## Quick Deploy

### Option 1: Using render.yaml (Recommended)

1. **Push your code to Git**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Blueprint"
   - Connect your repository
   - Render will automatically detect the `render.yaml` file

3. **Configure Environment Variables**
   
   Render will prompt you to set these required variables:
   
   **Required:**
   - `GEMINI_API_KEY` - Your Google Gemini AI API key
   
   **Optional (for SMS):**
   - `AFRICASTALKING_USERNAME` - Your Africa's Talking username (or "sandbox")
   - `AFRICASTALKING_API_KEY` - Your Africa's Talking API key
   - `AFRICASTALKING_SANDBOX` - Set to `true` for sandbox mode
   
   **Optional (for Email):**
   - `EMAIL_HOST` - SMTP host (e.g., smtp.gmail.com)
   - `EMAIL_PORT` - SMTP port (default: 587)
   - `EMAIL_USER` - SMTP username
   - `EMAIL_PASS` - SMTP password
   - `EMAIL_FROM` - From email address
   
   **Auto-generated (leave as is):**
   - `SESSION_SECRET` - Auto-generated secure secret
   - `JWT_SECRET` - Auto-generated secure secret

4. **Deploy**
   - Click "Apply"
   - Render will build and deploy your application
   - Wait for the build to complete (typically 5-10 minutes)

### Option 2: Manual Setup

1. **Create a New Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your repository

2. **Configure the Service**
   - **Name:** `nego-messaging` (or your preferred name)
   - **Region:** Choose closest to your users
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Starter (or higher)

3. **Add Environment Variables**
   
   Go to "Environment" tab and add:
   
   ```
   NODE_ENV=production
   PORT=3000
   SESSION_SECRET=<generate-a-random-string>
   JWT_SECRET=<generate-a-random-string>
   DATABASE_PATH=./server/messaging.db
   GEMINI_API_KEY=<your-gemini-api-key>
   
   # Optional - Africa's Talking SMS
   AFRICASTALKING_USERNAME=sandbox
   AFRICASTALKING_API_KEY=<your-key>
   AFRICASTALKING_SANDBOX=true
   
   # Optional - Email
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=<your-email>
   EMAIL_PASS=<your-password>
   EMAIL_FROM=<from-email>
   ```

4. **Create the Service**
   - Click "Create Web Service"
   - Wait for deployment to complete

## Post-Deployment

### 1. Verify Deployment

Once deployed, your app will be available at:
```
https://your-app-name.onrender.com
```

Test the following:
- ✅ Landing page loads
- ✅ Registration works
- ✅ Login works
- ✅ Can create and join rooms
- ✅ Real-time messaging works
- ✅ AI agent responds (if GEMINI_API_KEY is set)

### 2. Set Up Custom Domain (Optional)

1. Go to your service → "Settings" → "Custom Domains"
2. Add your domain
3. Update your DNS records as instructed by Render

### 3. Enable Persistent Storage (Important!)

**Note:** By default, Render's disk storage is ephemeral. Your SQLite database will be reset on each deploy!

**Options:**

**A. Use Render Disk (Recommended for small apps)**
1. Go to service → "Settings" → "Disks"
2. Add a new disk:
   - **Name:** `messaging-data`
   - **Mount Path:** `/data`
   - **Size:** 1GB (or more)
3. Update `DATABASE_PATH` env var to: `/data/messaging.db`
4. Redeploy

**B. Upgrade to PostgreSQL (Recommended for production)**

For larger deployments, consider migrating from SQLite to PostgreSQL:
1. Create a PostgreSQL database on Render
2. Update database.js to support PostgreSQL
3. Set `DATABASE_URL` environment variable

### 4. Monitor Your Application

- **Logs:** View real-time logs in the Render dashboard
- **Metrics:** Monitor CPU, memory, and bandwidth usage
- **Health Check:** Render pings `/api/health` every minute

## Important Notes

### Database Considerations

⚠️ **SQLite Limitations on Render:**
- Ephemeral disk by default (data lost on redeploy)
- Not recommended for high-traffic production
- Add Render Disk or migrate to PostgreSQL for production

### File Uploads

If your app handles file uploads:
- Store files in Render Disk or external storage (AWS S3, Cloudinary)
- Don't rely on local filesystem for persistent files

### WebSockets

Socket.io works out of the box on Render. No special configuration needed!

### Scaling

- **Starter Plan:** 512MB RAM, 0.5 CPU
- **Standard Plan:** 2GB RAM, 1 CPU
- **Pro Plan:** 4GB+ RAM, 2+ CPU

Start with Starter and upgrade as needed.

## Troubleshooting

### Build Fails

**Error:** `npm ERR! Missing dependencies`
- **Fix:** Ensure all dependencies are in `package.json`, not just `devDependencies`

**Error:** `ENOENT: no such file or directory`
- **Fix:** Check file paths are correct and case-sensitive

### App Crashes After Deploy

**Check logs:**
```bash
# From Render dashboard
Go to your service → "Logs" tab
```

**Common issues:**
- Missing environment variables
- Database connection errors
- Port binding (ensure using `process.env.PORT`)

### Database Resets on Deploy

- **Fix:** Add a Render Disk (see "Enable Persistent Storage" above)

### WebSocket Connection Fails

- **Fix:** Ensure your client connects to the correct URL (use relative path or detect from `window.location`)

## Getting Help

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com/)
- Check your service logs for error details

## Updating Your App

After making changes:

```bash
git add .
git commit -m "Your update message"
git push origin main
```

Render will automatically detect the push and redeploy (if auto-deploy is enabled).

## Cost Estimate

**Free Tier:**
- Limited hours per month
- Apps sleep after 15 minutes of inactivity
- Good for testing

**Starter Plan (~$7/month):**
- Always on
- 512MB RAM
- Good for small apps

**Standard Plan (~$25/month):**
- 2GB RAM
- Good for production apps with moderate traffic

---

Need help? Open an issue or contact support!
