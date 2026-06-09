# MindAnchor — Frontend

React + TypeScript + Vite + Tailwind, configured as an installable **PWA**.

## Setup

```bash
cd frontend
npm install
```

## Run

```bash
npm run dev
```

Opens http://localhost:5173. API calls to `/api/*` are proxied to the backend on `:8000` (see `vite.config.ts`).

## Build

```bash
npm run build
npm run preview
```

## PWA

`vite-plugin-pwa` generates the service worker and manifest. The app is installable on desktop and mobile browsers. Add real `icon-192.png` / `icon-512.png` to `public/` before production (placeholders for now).
