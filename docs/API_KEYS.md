# API Keys & Registrations Checklist

Complete guide: where to register, what to get, and where to use it.

---

## REQUIRED for Phase 1 MVP

### 1. Groq API (LLM + STT) — FREE
**What**: Llama 3.3 70B for dialogue + Whisper for speech recognition
**Free tier**: 30 req/min, 6000 req/day LLM | 7200 audio-min/hour STT
**Register**: https://console.groq.com
**Steps**:
1. Sign up with GitHub or Google
2. Go to API Keys → Create API Key
3. Copy key → set `GROQ_API_KEY` in .env

---

### 2. Google AI Studio / Gemini (LLM backup + embeddings) — FREE
**What**: Gemini 2.0 Flash (backup LLM), text-embedding-004, Google OAuth
**Free tier**: 1500 req/day Gemini Flash, 1500 req/day embeddings
**Register**: https://aistudio.google.com/apikey
**Steps**:
1. Sign in with Google account
2. Click "Create API key"
3. Copy key → set `GOOGLE_API_KEY` in .env

---

### 3. Google Cloud Console (OAuth for login) — FREE
**What**: Google OAuth for user login via NextAuth.js
**Register**: https://console.cloud.google.com
**Steps**:
1. Create new project: "lingua-companion"
2. APIs & Services → OAuth consent screen → External
3. APIs & Services → Credentials → Create OAuth 2.0 Client ID
4. Application type: Web application
5. Authorized redirect URIs: `https://yourdomain.com/api/auth/callback/google`
6. Copy Client ID → `GOOGLE_CLIENT_ID`
7. Copy Client Secret → `GOOGLE_CLIENT_SECRET`

---

### 4. Supabase (PostgreSQL + pgvector + Storage) — FREE
**What**: Managed PostgreSQL with pgvector extension, file storage for audio
**Free tier**: 500MB database, 1GB storage, 2 projects
**Register**: https://supabase.com
**Steps**:
1. Create account → New Project → "lingua-companion"
2. Choose region closest to your VPS (Frankfurt or closest EU)
3. Settings → Database → copy connection string → `DATABASE_URL`
4. Settings → API → copy Project URL → `SUPABASE_URL`
5. Settings → API → copy anon key → `SUPABASE_ANON_KEY`
6. Settings → API → copy service_role key → `SUPABASE_SERVICE_ROLE_KEY`
7. Enable pgvector: SQL Editor → run `CREATE EXTENSION IF NOT EXISTS vector;`

---

### 5. Upstash Redis (Cache) — FREE
**What**: Managed Redis for caching and Celery broker
**Free tier**: 10,000 requests/day, 256MB
**Register**: https://upstash.com
**Steps**:
1. Create account → Create Database
2. Select region: EU (Frankfurt)
3. Copy Redis URL → `REDIS_URL`

**Alternative**: Run Redis in Docker on VPS (fully free, see VPS_SETUP.md)

---

## REQUIRED for Phase 2

### 6. Azure Speech Services (Pronunciation Analysis)
**What**: Phoneme-level pronunciation scoring
**Free tier**: 5 hours/month (F0 tier)
**Register**: https://portal.azure.com
**Steps**:
1. Create Azure account (free tier available)
2. Create resource → "Cognitive Services" → "Speech"
3. Select Free tier (F0): 5 hours/month
4. Resource → Keys and Endpoint
5. Copy Key 1 → `AZURE_SPEECH_KEY`
6. Copy Region → `AZURE_SPEECH_REGION` (e.g., `eastus`)

---

### 7. Reddit API (Topic Discovery)
**What**: Fetch trending tech discussions from subreddits
**Free tier**: 100 requests/minute (more than enough)
**Register**: https://www.reddit.com/prefs/apps
**Steps**:
1. Log in to Reddit
2. Scroll to "Developed Applications" → "Create App"
3. Type: script
4. Redirect URI: http://localhost
5. Copy app ID → `REDDIT_CLIENT_ID`
6. Copy secret → `REDDIT_CLIENT_SECRET`

---

## OPTIONAL but Recommended

### 8. ElevenLabs (Premium TTS — Phase 2)
**What**: High-quality natural TTS for shadowing trainer
**Free tier**: 10,000 characters/month
**Register**: https://elevenlabs.io
**Steps**:
1. Create account
2. Profile → API Key → Copy
3. Set `ELEVENLABS_API_KEY` in .env

---

### 9. Sentry (Error Monitoring — Phase 2)
**What**: Track errors in production
**Free tier**: 5,000 errors/month
**Register**: https://sentry.io
**Steps**:
1. Create account → New Project → Next.js + Python FastAPI
2. Copy DSN for each project
3. Set `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` in .env

---

## Infrastructure

### 10. Domain Name
**What**: Custom domain for the app
**Recommended registrar**: Namecheap, Cloudflare Registrar, or reg.ru
**Suggested name**: `linguacompanion.app` or `lingua.creatman.site` (subdomain = free)
**Cloudflare**: Add domain to Cloudflare for free CDN + DDoS protection

### 11. Coolify (on your VPS)
**What**: Self-hosted PaaS for managing deployments
**Cost**: Free (self-hosted)
**Install**: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
**Access**: http://178.17.50.45:8888 after install

---

## Quick Reference Table

| Service | Purpose | Free Tier | Register At |
|---------|---------|-----------|-------------|
| Groq | LLM + STT | 6000 req/day | console.groq.com |
| Google AI Studio | Gemini + Embeddings | 1500 req/day | aistudio.google.com |
| Google Cloud | OAuth login | Free | console.cloud.google.com |
| Supabase | PostgreSQL + Storage | 500MB DB | supabase.com |
| Upstash | Redis | 10K req/day | upstash.com |
| Azure Speech | Pronunciation | 5 hrs/month | portal.azure.com |
| Reddit API | Topic Discovery | 100 req/min | reddit.com/prefs/apps |
| ElevenLabs | Premium TTS | 10K chars/mo | elevenlabs.io |
| Sentry | Error tracking | 5K errors/mo | sentry.io |
| Cloudflare | CDN + DNS | Free | cloudflare.com |

**Total Phase 1 cost: $0/month** (within free tiers)
**Estimated Phase 2 cost at 100 active users: ~$5-15/month**
