# ==============================================================================
# Cindermarch Engine Hub // Studio Operating System
# Production Multi-Stage Container Image
# ==============================================================================

# --- STAGE 1: Frontend Builder ---
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- STAGE 2: Backend & Services Builder ---
FROM node:20-bookworm-slim AS backend-builder
WORKDIR /app

# Install build essentials for native better-sqlite3 compilation
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY services/discord-bot/package*.json ./services/discord-bot/

RUN npm install --include=dev

COPY backend/ ./backend/
COPY services/discord-bot/ ./services/discord-bot/

RUN npm --prefix backend run build
RUN npm --prefix services/discord-bot run build

# --- STAGE 3: Production Runtime ---
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# Install curl for container health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl sqlite3 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3001

# Copy workspace package manifests
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY services/discord-bot/package*.json ./services/discord-bot/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built artifacts from builder stages
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/services/discord-bot/dist ./services/discord-bot/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure persistence directories exist
RUN mkdir -p /app/data /app/uploads

# Expose HTTP port
EXPOSE 3001

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Default startup: Boots Engine Hub API server, runs migrations, serves production web app & starts background scheduler
CMD ["node", "backend/dist/server.js"]
