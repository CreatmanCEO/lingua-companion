# VPS Setup Guide — 178.17.50.45

## Server Specs

- **IP**: 178.17.50.45
- **RAM**: 4GB
- **Storage**: 60GB
- **OS**: Ubuntu 22.04 (recommended)

## Port Allocation

```
Port   Service              Access
─────────────────────────────────────────────
22     SSH                  External (your IP only)
80     Nginx HTTP           External → redirect to 443
443    Nginx HTTPS          External
8888   Coolify Panel        External (or tunnel)
3000   Next.js              Internal only (via Nginx)
8000   FastAPI              Internal only (via Nginx)
5432   PostgreSQL           Internal only
6379   Redis                Internal only
6333   Qdrant               Internal only (Phase 2)
9000   MinIO (if needed)    Internal only
```

**Note**: All ports scanned on 2026-03-07 — all showed as filtered/closed externally. Firewall is active. Open only what's needed.

## Step 1: Initial Server Setup

```bash
# Connect to VPS
ssh root@178.17.50.45

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Install Docker Compose
apt install docker-compose-plugin -y

# Install Nginx
apt install nginx -y

# Install Certbot (SSL)
apt install certbot python3-certbot-nginx -y

# Open required ports in firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8888/tcp   # Coolify panel
ufw enable
```

## Step 2: Install Coolify

```bash
# Install Coolify (self-hosted PaaS)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# Access Coolify panel at: http://178.17.50.45:8888
# Complete initial setup in browser
```

## Step 3: DNS Setup

Point your domain to the VPS:
```
A record:  lingua.yourdomain.com → 178.17.50.45
A record:  api.yourdomain.com    → 178.17.50.45
```

## Step 4: SSL Certificate

```bash
# After DNS propagates
certbot --nginx -d lingua.yourdomain.com -d api.yourdomain.com
```

## Step 5: Clone and Configure Project

```bash
# On VPS
cd /opt
git clone https://github.com/CreatmanCEO/lingua-companion.git
cd lingua-companion
cp .env.example .env
nano .env  # Fill in all API keys
```

## Step 6: Docker Compose Services

```yaml
# infra/docker/docker-compose.yml (reference)
services:
  web:
    build: ./apps/web
    ports: ["3000:3000"]
    env_file: .env

  api:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [postgres, redis]

  celery:
    build: ./backend
    command: celery -A app.celery worker
    env_file: .env
    depends_on: [redis]

  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: lingua_companion
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: ["pgdata:/var/lib/postgresql/data"]

  redis:
    image: redis:7-alpine
    volumes: ["redisdata:/data"]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./infra/nginx/nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

## Step 7: Nginx Configuration

```nginx
# /etc/nginx/sites-available/lingua-companion
server {
    listen 443 ssl;
    server_name lingua.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/lingua.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lingua.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

## Step 8: Coolify Auto-Deploy Setup

1. In Coolify panel: Add new resource → GitHub repository
2. Connect to `CreatmanCEO/lingua-companion`
3. Set build command per service
4. Add webhook in GitHub → Settings → Webhooks
5. Every push to `main` triggers auto-deploy

## Memory Optimization for 4GB VPS

```bash
# Add swap space as buffer
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Limit PostgreSQL memory
# In postgresql.conf:
shared_buffers = 256MB
work_mem = 16MB
maintenance_work_mem = 128MB
```

## Monitoring

```bash
# Check service status
docker compose ps
docker compose logs -f api

# Check memory usage
free -h
docker stats

# Check disk usage
df -h
```
