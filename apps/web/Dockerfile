# syntax=docker/dockerfile:1

# ================================
# Stage 1: Dependencies
# ================================
FROM node:20-alpine AS deps
WORKDIR /app

# Установка pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Копирование файлов зависимостей
COPY pnpm-lock.yaml* package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/

# Установка зависимостей
RUN pnpm install --frozen-lockfile

# ================================
# Stage 2: Builder
# ================================
FROM node:20-alpine AS builder
WORKDIR /app

# Установка pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Копирование зависимостей из предыдущего stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
# packages/types может не иметь node_modules (no runtime deps)
COPY --from=deps /app/packages/types ./packages/types

# Копирование исходного кода
COPY . .

# Build arguments для environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Сборка приложения
WORKDIR /app/apps/web
RUN pnpm build

# ================================
# Stage 3: Runner
# ================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Создание пользователя для безопасности
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Копирование статических файлов
COPY --from=builder /app/apps/web/public ./public

# Копирование standalone build
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Запуск приложения
CMD ["node", "apps/web/server.js"]
