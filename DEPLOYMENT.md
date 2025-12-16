# RequestPing Deployment Guide

## Overview

RequestPing consists of two parts:
- **Backend API** → Deploy to Railway
- **Frontend** → Deploy to GitHub Pages (or Cloudflare Pages)

## Prerequisites

1. FOIA.gov API key from https://api.data.gov/signup/
2. Resend API key from https://resend.com/api-keys
3. Railway account (https://railway.app)
4. GitHub account

## Part 1: Deploy Backend to Railway

### 1. Create Railway Project

```bash
# Install Railway CLI (if not already installed)
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init
```

### 2. Configure Environment Variables

In Railway dashboard, add these environment variables:

```
FOIA_API_KEY=your_foia_api_key_here
RESEND_API_KEY=your_resend_api_key_here
FROM_EMAIL=requests@requestping.com
JWT_SECRET=generate_a_random_32_byte_hex_string
PORT=3000
NODE_ENV=production
DB_PATH=/app/database/requestping.db
```

Generate JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Deploy

```bash
# Deploy to Railway
railway up

# Get your deployment URL
railway domain
```

Your backend will be available at: `https://your-app-name.railway.app`

### 4. Initialize Database

After first deployment, run:
```bash
railway run node database/init.js
```

## Part 2: Deploy Frontend to GitHub Pages

### 1. Update API Configuration

Edit `public/js/config.js`:

```javascript
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3002'
    : 'https://your-railway-app.railway.app'; // Your Railway URL here
```

### 2. Create GitHub Repository

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# Create repository on GitHub and push
git remote add origin https://github.com/yourusername/requestping.git
git branch -M main
git push -u origin main
```

### 3. Setup GitHub Pages

Option A: **Separate frontend repository**

1. Create a new repo called `requestping-frontend`
2. Copy only the `public/` directory contents
3. Push to GitHub
4. Enable GitHub Pages in Settings → Pages
5. Select `main` branch
6. Site will be available at `https://yourusername.github.io/requestping-frontend/`

Option B: **Deploy from main repo**

1. In GitHub repo settings → Pages
2. Select `main` branch
3. Select `/public` folder
4. Save

## Part 3: Alternative Frontend Deployment (Cloudflare Pages)

If you prefer Cloudflare Pages:

1. Connect GitHub repository to Cloudflare Pages
2. Build settings:
   - Build command: (leave empty)
   - Build output directory: `public`
3. Deploy

## Part 4: Custom Domain (Optional)

### Railway (Backend)

1. In Railway dashboard → Settings → Domains
2. Add custom domain (e.g., `api.requestping.com`)
3. Update DNS records as instructed

### GitHub Pages / Cloudflare (Frontend)

1. Add custom domain in settings
2. Update DNS records:
   - For GitHub Pages: Add CNAME record
   - For Cloudflare Pages: Automatic

### Update CORS

In `api/server.js`, update CORS configuration:

```javascript
app.use(cors({
    origin: ['https://requestping.com', 'https://www.requestping.com']
}));
```

## Testing Deployment

1. Visit your frontend URL
2. Try signing up for an account
3. Create a test FOIA request
4. Check Railway logs for any errors:
   ```bash
   railway logs
   ```

## Troubleshooting

### Database Issues

If database doesn't persist between Railway deployments:

1. Add a volume in Railway dashboard
2. Mount to `/app/database`
3. Update `DB_PATH` to use persistent storage

### CORS Errors

If you get CORS errors:

1. Check that API_BASE_URL in config.js is correct
2. Verify CORS configuration in server.js matches your frontend domain
3. Check Railway logs for blocked requests

### Email Not Sending

1. Verify Resend API key is correct
2. Check that FROM_EMAIL domain is verified in Resend
3. Check Railway logs for email errors

## Monitoring

### Railway Logs

```bash
# Watch real-time logs
railway logs --follow

# View recent logs
railway logs
```

### Database Backup

Export database regularly:

```bash
# Connect to Railway
railway run bash

# Export database
sqlite3 database/requestping.db .dump > backup.sql
```

## Scaling Considerations

For production use:

1. **Switch to PostgreSQL** instead of SQLite for Railway
2. **Add rate limiting** to API endpoints
3. **Implement request queueing** for FOIA submissions
4. **Add monitoring** (Sentry, LogRocket)
5. **Set up automated backups**
6. **Add CDN** for static assets (Cloudflare)

## Security Checklist

- [ ] JWT_SECRET is strong random value
- [ ] RESEND_API_KEY is kept secret
- [ ] FOIA_API_KEY is kept secret
- [ ] CORS is configured for production domains only
- [ ] HTTPS is enforced (automatic on Railway/GitHub Pages)
- [ ] Database has no public access
- [ ] API rate limiting is implemented
- [ ] Input validation is in place

## Cost Estimates

**Railway** (Backend):
- Free tier: $0/month (500 hours)
- Hobby: $5/month (unlimited)

**GitHub Pages** (Frontend):
- Free for public repos

**Resend** (Email):
- Free tier: 100 emails/day
- Paid: $20/month for 50,000 emails

**Total**: ~$5-25/month depending on usage

## Support

For deployment issues, check:
- Railway docs: https://docs.railway.app
- GitHub Pages docs: https://docs.github.com/pages
- Resend docs: https://resend.com/docs
