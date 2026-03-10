# VPS Setup — 178.17.50.45

## Актуальное состояние сервера (проверено 2026-03-10)

| Параметр | Значение |
|----------|----------|
| RAM | 4GB (2.1GB доступно) |
| Диск | 59GB (31GB свободно) |
| Swap | 2GB (увеличен) |
| OS | Ubuntu 24.04 |
| Docker | Установлен ✅ |
| Coolify | Установлен, работает на :8000 ✅ |

---

## Занятые порты (существующие сервисы)

```
22      SSH
80      Nginx → creatman.site (портфолио)
443     Nginx → creatman.site (HTTPS)
3000    creatman-portfolio (Next.js)
6001    Coolify realtime
6002    Coolify realtime
8000    Coolify панель
32685   Amnezia VPN (UDP)
```

## Порты для LinguaCompanion

```
3001    → Next.js web app (lingua.creatman.site)
8001    → FastAPI backend  (api.lingua.creatman.site)
5433    → PostgreSQL (внутренний)
6380    → Redis (внутренний)
6333    → Qdrant (внутренний, Phase 2)
```

---

## Coolify

Уже установлен. Панель: `http://178.17.50.45:8000`

Подключить репозиторий:
1. Открыть Coolify → Add New Resource → GitHub
2. Выбрать `CreatmanCEO/lingua-companion`
3. Настроить webhook для авто-деплоя при push в `main`

---

## Добавить домен для LinguaCompanion

В DNS (Cloudflare или reg.ru) добавить A-записи:
```
lingua.creatman.site    → 178.17.50.45
api.lingua.creatman.site → 178.17.50.45
```

Nginx конфиг добавить в `creatman-nginx` контейнер.

---

## Docker Compose для LinguaCompanion

```yaml
# lingua-companion/infra/docker/docker-compose.yml
services:
  web:
    build: ../../apps/web
    ports: ["3001:3000"]
    env_file: ../../.env
    restart: unless-stopped

  api:
    build: ../../backend
    ports: ["8001:8000"]
    env_file: ../../.env
    depends_on: [postgres, redis]
    restart: unless-stopped

  celery:
    build: ../../backend
    command: celery -A app.celery worker --loglevel=info
    env_file: ../../.env
    depends_on: [redis]
    restart: unless-stopped

  postgres:
    image: pgvector/pgvector:pg16
    ports: ["5433:5432"]
    environment:
      POSTGRES_DB: lingua_companion
      POSTGRES_USER: lingua
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - lingua_pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports: ["6380:6379"]
    volumes:
      - lingua_redisdata:/data
    restart: unless-stopped

volumes:
  lingua_pgdata:
  lingua_redisdata:
```

---

## Nginx конфиг для LinguaCompanion

Добавить файл в контейнер `creatman-nginx`:

```nginx
# lingua.conf
server {
    listen 80;
    server_name lingua.creatman.site;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name lingua.creatman.site;

    ssl_certificate     /etc/letsencrypt/live/lingua.creatman.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lingua.creatman.site/privkey.pem;

    location / {
        proxy_pass http://host.docker.internal:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 443 ssl http2;
    server_name api.lingua.creatman.site;

    ssl_certificate     /etc/letsencrypt/live/api.lingua.creatman.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.lingua.creatman.site/privkey.pem;

    location / {
        proxy_pass http://host.docker.internal:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket для голосового pipeline
    location /ws {
        proxy_pass http://host.docker.internal:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_read_timeout 3600;
    }
}
```

---

## Мониторинг

```bash
# Статус всех контейнеров
docker ps

# Логи LinguaCompanion
docker logs lingua-api -f
docker logs lingua-web -f

# Использование ресурсов
docker stats

# Память
free -h

# Диск
df -h
```

---

## Технический spike (проверка Whisper code-switching)

### Что это и зачем

Перед началом разработки нужно убедиться что Groq Whisper корректно
распознаёт смешанную русско-английскую речь. Это главный технический риск.

### Шаги

**1. Запиши 5 фраз на телефоне** (голосовые заметки / диктофон):
```
"Yesterday я работал над automation pipeline"
"Мне нужно implement новый feature до Friday"
"У нас был deploy сегодня и всё сломалось"
"Я нашёл баг в authentication модуле"
"Наш team делает code review каждую пятницу"
```

**2. Скинь файлы на компьютер** (любой формат: m4a, mp3, wav, ogg)

**3. Создай файл `spike_stt.py`:**
```python
import os
from groq import Groq

client = Groq(api_key=os.environ["GROQ_API_KEY"])

def test(path):
    with open(path, "rb") as f:
        result = client.audio.transcriptions.create(
            file=(path, f.read()),
            model="whisper-large-v3-turbo",
            response_format="verbose_json",
            language=None,  # авто-определение — важно!
        )
    print(f"\nФайл: {path}")
    print(f"Текст: {result.text}")
    print(f"Язык: {result.language}")

# Запусти для каждого файла
test("phrase1.m4a")
test("phrase2.m4a")
# ...
```

**4. Установи библиотеку и запусти:**
```bash
pip install groq
export GROQ_API_KEY=твой_ключ
python spike_stt.py
```

**5. Что считать успехом:**
- ✅ Русские слова не потеряны и не заменены английскими
- ✅ Смешанные фразы распознаны полностью
- ✅ Latency < 1 сек на фразу
- ❌ Если русские слова искажаются → тест с `language="ru"` + отдельный English pass

**Общее время spike: 1-2 часа включая запись фраз.**
