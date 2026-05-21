# 🚀 ForestBrawl.io Deployment Guide

## Quick Deploy on Render.com

### Step 1: Prepare Your GitHub Repository

```bash
cd /workspaces/forestbrawl.io

# Initialize git if not already done
git init

# Add deployment files
git add -A

# Commit
git commit -m "Add ForestBrawl.io deployment configuration

- Added pnpm workspace setup
- Added render.yaml for Render.com deployment
- Added Dockerfile and docker-compose.yml
- Added comprehensive README and deployment guide
- Fixed static file serving path
- All tests passing"

# Push to GitHub
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/forestbrawl.io.git
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to https://render.com and sign up/login
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: forestbrawl-io
   - **Environment**: Docker
   - **Dockerfile Path**: Dockerfile
   - **Root Directory**: `/` if you use the repo root service, or `game/` if you want the game subfolder service
   - **Instance Type**: Starter (for testing) or Standard (for production)

#### Build Command
```bash
cd artifacts && pnpm install && pnpm run build
```

#### Start Command
```bash
node --enable-source-maps artifacts/api-server/dist/index.cjs
```

#### Environment Variables
Add these in Render dashboard (Settings → Environment):

```
NODE_ENV=production
PORT=8080
SESSION_SECRET=<generate-with: openssl rand -base64 32>
```

5. Click "Deploy"

### Step 3: Verify Deployment

Once deployed, test the endpoints:

```bash
# Replace YOUR_RENDER_URL with your actual Render URL
curl https://YOUR_RENDER_URL/api/healthz

# Open in browser
https://YOUR_RENDER_URL/forestbrawl/
```

## Local Docker Testing

Before deploying to Render, test locally with Docker.

If you are in the `game/` folder, build with the `game/Dockerfile`:

```bash
cd game

docker build -t forestbrawl:latest .

# Run container
docker run -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e SESSION_SECRET=test-secret \
  forestbrawl:latest

# Test
curl http://localhost:8080/api/healthz
```

If you want to build from the repository root with the top-level Dockerfile, use this command instead:

```bash
cd /workspaces/forestbrawl.io

docker build -f Dockerfile -t forestbrawl:latest .
```

Or use docker-compose:

```bash
docker-compose up
# Access at http://localhost:8080/forestbrawl/```
```

## Alternative: Docker Compose with Render

For persistent storage, you can use:

```bash
docker-compose -f docker-compose.yml up -d
```

## Production Checklist

- [ ] Change `SESSION_SECRET` to a strong random value
- [ ] Set `NODE_ENV=production`
- [ ] Configure SSL/TLS (Render handles this automatically)
- [ ] Set up regular backups of `data/` directory
- [ ] Monitor error logs in Render dashboard
- [ ] Test all features:
  - User registration
  - User login
  - Starting a game
  - Real-time multiplayer (Socket.io)
  - Leaderboard updates

## Troubleshooting

### Application won't start
```
Check logs: Render Dashboard → Logs
Common issues:
- Wrong PORT value
- Missing environment variables
- Build failed (check build logs)
```

### Static files returning 404
```
Verify path in Render build output:
- artifacts/forestbrawl/dist/public/ should contain index.html
- API server should serve from /forestbrawl path
```

### Socket.io connection failing
```
Ensure WebSocket is enabled:
1. Check browser console for errors
2. Verify path: /api/socket.io
3. Check Render firewall settings
```

### Database/data not persisting
```
Render's ephemeral filesystem deletes data on redeploy.
Solution: Use a persistent database (MongoDB, PostgreSQL)
or configure Render volumes.
```

## Performance Tips

1. **Caching**: Enable caching headers in Express
2. **Compression**: gzip is configured by default
3. **CDN**: Consider Cloudflare for static assets
4. **Database**: Migrate from JSON files to a real database
5. **Scaling**: Use Render's auto-scaling features for traffic spikes

## Files Reference

| File | Purpose |
|------|---------|
| `render.yaml` | Render deployment configuration |
| `Dockerfile` | Docker image build instructions |
| `docker-compose.yml` | Local development with Docker |
| `.nvmrc` | Node.js version specification |
| `.env.example` | Environment variables template |
| `README.md` | Project documentation |

## Support & Issues

For issues with deployment:
1. Check Render logs
2. Verify environment variables are set
3. Test locally with `docker-compose up`
4. Check socket.io connection in browser console
5. Review application logs: `tail -f artifacts/api-server/data/*.log`

---

**Deployment Date**: 2026-05-21
**Version**: 1.0.0
**Status**: ✅ Ready for Production
