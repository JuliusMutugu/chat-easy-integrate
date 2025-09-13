# Deployment Guide for Render

## Prerequisites

1. **GitHub Repository**: Ensure your code is pushed to a GitHub repository
2. **Render Account**: Create a free account at [render.com](https://render.com)

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Connect GitHub Repository**:

   - Go to your Render dashboard
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` file

2. **Set Environment Variables** (These will be set automatically, but you can customize):
   ```
   NODE_ENV=production
   DATABASE_URL=/opt/render/project/src/data/messaging.db
   SERVER_URL=https://your-app-name.onrender.com
   CLIENT_URL=https://your-app-name.onrender.com
   CORS_ORIGIN=https://your-app-name.onrender.com
   ```

### Option 2: Manual Setup

1. **Create Web Service**:

   - Go to Render dashboard
   - Click "New" → "Web Service"
   - Connect your GitHub repository

2. **Configure Build & Deploy**:

   - **Build Command**: `npm run install-all && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`

3. **Set Environment Variables**:

   ```
   NODE_ENV=production
   DATABASE_URL=/opt/render/project/src/data/messaging.db
   SERVER_URL=https://your-app-name.onrender.com
   CLIENT_URL=https://your-app-name.onrender.com
   CORS_ORIGIN=https://your-app-name.onrender.com
   ```

4. **Add Persistent Disk**:
   - Go to your service settings
   - Add a disk with mount path: `/opt/render/project/src/data`
   - Size: 1GB (sufficient for SQLite database)

## Important Notes

- **Database Persistence**: The SQLite database is stored on a persistent disk to survive deployments
- **Environment URLs**: Replace `your-app-name` with your actual Render service name
- **Free Tier**: On Render's free tier, services sleep after 15 minutes of inactivity
- **Health Check**: The `/api/health` endpoint ensures your service is running properly

## Features Included

✅ Real-time messaging with Socket.IO  
✅ Room creation and management  
✅ Live location sharing  
✅ Persistent SQLite database  
✅ Invite system with shareable links  
✅ Responsive design for mobile/desktop

## Local Development

To run locally after deployment setup:

```bash
# Install dependencies
npm run install-all

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Troubleshooting

1. **Build Fails**: Check that all dependencies are properly listed in package.json
2. **Database Issues**: Ensure the data directory has write permissions
3. **Socket Connection**: Verify CORS_ORIGIN and SERVER_URL are set correctly
4. **Environment Variables**: Make sure all required env vars are set in Render dashboard

## Support

If you encounter issues, check:

- Render service logs in the dashboard
- Network tab in browser dev tools for connection issues
- Console logs for client-side errors
