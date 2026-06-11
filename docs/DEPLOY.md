# MindAnchor — Deployment Guide

## Stack

```
GitHub (main branch)
    │
    ├─── Railway  ──► FastAPI backend + Postgres DB
    │                 (auto-deploys on push, Dockerfile-based)
    │
    └─── Vercel   ──► React PWA frontend
                      (auto-deploys on push, pre-built dist)
```

**Total cost: ~$5/mo on Railway Hobby plan. Vercel is free.**

---

## One-time setup (browser only — no CLI needed)

### Step 1 — Railway (backend + database)

1. Go to **railway.app** → sign up with GitHub
2. **New Project → Deploy from GitHub repo** → select `OwnYourSystem/MindAnchor`
3. When asked which directory: select **`backend/`**
4. Railway detects the `Dockerfile` automatically — click **Deploy**
5. Once deployed, click **+ New** → **Database** → **Add PostgreSQL**
   - Railway injects `DATABASE_URL` automatically into your service
6. In your backend service → **Variables** tab, add these env vars:
   ```
   ENVIRONMENT        = production
   JWT_SECRET         = <generate: openssl rand -base64 48>
   ANTHROPIC_API_KEY  = sk-ant-...
   CORS_ORIGINS       = https://YOUR_VERCEL_URL.vercel.app
   ```
7. Copy the **public URL** Railway gives the service (looks like `https://mindanchor-api-production.up.railway.app`)

### Step 2 — Vercel (frontend)

1. Go to **vercel.com** → sign up with GitHub
2. **Add New Project** → Import `OwnYourSystem/MindAnchor`
3. Set **Root Directory** to `frontend`
4. Vercel auto-detects Vite — click **Deploy**
5. Once deployed, copy the URL (e.g. `https://mindanchor.vercel.app`)
6. Go back to Railway and update `CORS_ORIGINS` to this Vercel URL

### Step 3 — Wire the proxy URL

Update `frontend/vercel.json` — replace `RAILWAY_BACKEND_URL` with your actual Railway URL:

```json
"destination": "https://mindanchor-api-production.up.railway.app/:path*"
```

Then commit and push — Vercel redeploys automatically.

### Step 4 — GitHub Actions secrets

Go to **GitHub repo → Settings → Secrets and variables → Actions** and add:

| Secret | Where to find it |
|---|---|
| `RAILWAY_TOKEN` | railway.app → Account Settings → Tokens → New token |
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Run `vercel whoami` or check `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Check `.vercel/project.json` after first deploy |

After this, every push to `main` automatically:
- Runs tests → deploys backend to Railway → runs `alembic upgrade head` → deploys frontend to Vercel

---

## Running migrations manually

Railway Dashboard → your backend service → **Shell** tab:
```bash
alembic upgrade head
```

Or via Railway CLI locally:
```bash
npm install -g @railway/cli
railway login
railway run --service mindanchor-api alembic upgrade head
```

---

## Local development

```bash
# Backend
cd backend
cp .env.example .env     # fill in DATABASE_URL (local Postgres) + ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev              # http://localhost:5173
```

---

## Cost estimate

| Resource | Plan | ~Cost/mo |
|---|---|---|
| Railway Hobby | Backend + Postgres | ~$5 |
| Vercel | Hobby (free) | $0 |
| **Total** | | **~$5/mo** |
