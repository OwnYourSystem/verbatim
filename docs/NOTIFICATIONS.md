# Notifications & the morning briefing

MindAnchor's morning briefing content is produced by `GET /reports/morning-briefing` (focus, due today, flagged). How it reaches the user has two tiers.

## Tier 1 — implemented now (client-side)

On the **Reports** page:
- **Enable notifications** → `Notification.requestPermission()`.
- **Show briefing now** → fetches the briefing and displays it via the PWA service worker (`registration.showNotification(...)`), falling back to a direct `Notification`.

This works today with the PWA installed, no server infrastructure. It is user-triggered (a preview), not yet scheduled.

## Tier 2 — scheduled server push (deploy-time follow-up)

True "before you open the app" push requires infrastructure that belongs in the deploy phase:

1. **VAPID keys** — generate a public/private keypair; public key ships to the client, private key stays on the server.
2. **Subscription storage** — `POST /push/subscribe` saves each browser's `PushSubscription`; add a `PushSubscription` table.
3. **Sender** — backend uses `pywebpush` to send the briefing payload to stored subscriptions.
4. **Scheduler** — a cron/worker (e.g. Cloud Scheduler → a `/push/morning` endpoint, or APScheduler) fires each morning, builds the briefing, and pushes it.
5. **Service worker `push` handler** — a custom SW (`injectManifest` mode for vite-plugin-pwa) with a `push` event listener that calls `showNotification`.

### Why deferred

VAPID keys are secrets, the scheduler needs a hosted runtime, and the custom SW changes the PWA build mode. All of that is best done once we provision hosting (Cloud Run + Cloud Scheduler) in the deploy phase — not against the local network-share dev setup. The briefing *content* and the client notification path are done, so Tier 2 is purely a delivery/transport addition.
