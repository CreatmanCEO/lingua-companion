# LinguaCompanion Makefile
# Команды для разработки и деплоя

.PHONY: help dev dev-api dev-web test test-api test-web lint build build-api build-web deploy clean

# Показать справку
help:
	@echo "LinguaCompanion - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start all services (backend + frontend)"
	@echo "  make dev-api      - Start backend only (FastAPI + Celery + Redis + DB)"
	@echo "  make dev-web      - Start frontend only (Next.js on port 3001)"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run full test suite"
	@echo "  make test-api     - Run backend tests (pytest)"
	@echo "  make test-web     - Run frontend tests (vitest)"
	@echo ""
	@echo "Build:"
	@echo "  make build        - Build all services"
	@echo "  make build-api    - Build backend Docker image"
	@echo "  make build-web    - Build frontend"
	@echo ""
	@echo "Other:"
	@echo "  make lint         - Lint all code"
	@echo "  make lint-api     - Lint backend (flake8)"
	@echo "  make lint-web     - Lint frontend (eslint)"
	@echo "  make deploy       - Deploy via Coolify webhook"
	@echo "  make clean        - Clean build artifacts"

# === Development ===

dev:
	@echo "Starting all services..."
	docker-compose -f infra/docker-compose.yml up -d
	cd apps/web && pnpm dev

dev-api:
	@echo "Starting backend services..."
	docker-compose -f infra/docker-compose.yml up -d
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

dev-web:
	@echo "Starting frontend on port 3001..."
	cd apps/web && pnpm dev

# === Testing ===

test: test-api test-web
	@echo "All tests completed."

test-api:
	@echo "Running backend tests..."
	cd backend && python -m pytest tests/ -v

test-web:
	@echo "Running frontend tests..."
	cd apps/web && pnpm test

# === Linting ===

lint: lint-api lint-web
	@echo "Linting completed."

lint-api:
	@echo "Linting backend..."
	cd backend && python -m flake8 app/ --max-line-length=100

lint-web:
	@echo "Linting frontend..."
	cd apps/web && pnpm lint

# === Build ===

build: build-api build-web
	@echo "Build completed."

build-api:
	@echo "Building backend Docker image..."
	docker build -t lingua-companion-backend:latest -f backend/Dockerfile backend/

build-web:
	@echo "Building frontend..."
	cd apps/web && pnpm build

# === Deploy ===

deploy:
	@echo "Deploying via Coolify..."
	@echo "TODO: Add Coolify webhook URL"
	# curl -X POST https://coolify.example.com/webhook/deploy

# === Clean ===

clean:
	@echo "Cleaning build artifacts..."
	rm -rf apps/web/.next
	rm -rf apps/web/node_modules/.cache
	rm -rf backend/__pycache__
	rm -rf backend/.pytest_cache
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@echo "Clean completed."
