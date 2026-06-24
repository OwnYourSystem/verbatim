#!/usr/bin/env bash
# One-shot bootstrap for a fresh Ubuntu 24.04 server.
# Run as root or a user with sudo.
set -euo pipefail

REPO_URL="https://github.com/OwnYourSystem/MindAnchor.git"
APP_DIR="/opt/mindanchor"

echo "==> Installing Docker..."
apt-get update -q
apt-get install -y -q docker.io docker-compose-v2 curl git

systemctl enable --now docker

echo "==> Cloning repository to $APP_DIR..."
if [ -d "$APP_DIR/.git" ]; then
  echo "    (already cloned — pulling latest)"
  git -C "$APP_DIR" pull origin main
else
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

if [ ! -f ".env.production" ]; then
  cp .env.production.example .env.production
  echo ""
  echo "================================================================"
  echo "  ACTION REQUIRED: fill in .env.production before continuing."
  echo "  Edit the file: nano $APP_DIR/.env.production"
  echo "================================================================"
  echo ""
  read -rp "Press ENTER once you have saved .env.production..."
fi

echo "==> Building and starting all services..."
docker compose up --build -d

echo ""
echo "==> Waiting for backend to become healthy..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
    echo "    Backend is healthy!"
    break
  fi
  echo "    Attempt $i/30 — waiting 5s..."
  sleep 5
done

echo ""
echo "================================================================"
echo "  MindAnchor is running at http://$(curl -sf ifconfig.me || echo YOUR_IP)"
echo "  API health:  http://$(curl -sf ifconfig.me || echo YOUR_IP)/api/health"
echo ""
echo "  Useful commands:"
echo "    docker compose logs -f backend    # live backend logs"
echo "    docker compose ps                 # service status"
echo "    docker compose down               # stop everything"
echo "    docker compose up --build -d      # rebuild + restart"
echo "================================================================"
