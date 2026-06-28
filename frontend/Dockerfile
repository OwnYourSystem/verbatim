# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install deps against the lockfile first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci

# Build the static SPA (tsc -b && vite build → /app/dist).
COPY . .
RUN npm run build

# ── Serve stage ───────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Static assets.
COPY --from=build /app/dist /usr/share/nginx/html

# nginx config template — the official entrypoint runs envsubst on
# /etc/nginx/templates/*.template at startup (PORT / BACKEND_ORIGIN / BACKEND_HOST).
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Cloud Run injects PORT (8080); BACKEND_* are set on the service / via Cloud Build.
ENV PORT=8080
EXPOSE 8080
