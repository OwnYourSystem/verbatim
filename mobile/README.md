# Verbatim — Mobile (Expo / React Native)

React Native app built with **Expo Router** (file-based routing). Shares types and API logic with the web frontend.

## Structure

```
mobile/
├── app/                  # Expo Router file-based routes
│   ├── _layout.tsx       # Root layout — tab navigator
│   ├── index.tsx         # Today / Dashboard tab
│   ├── systems.tsx       # Systems tab
│   ├── proposals.tsx     # Proposals tab
│   └── reports.tsx       # Reports tab
├── src/
│   ├── api/index.ts      # API client (mirrors frontend/src/api.ts)
│   ├── types.ts          # Shared domain types
│   ├── components/ui.tsx # RN primitives: Card, StatusBadge, Empty
│   ├── hooks/useAsync.ts # Generic async data hook
│   └── screens/          # Screen implementations
│       ├── TodayScreen.tsx
│       ├── SystemsScreen.tsx
│       ├── ProposalsScreen.tsx
│       └── ReportsScreen.tsx
├── assets/               # App icon + splash (add icon.png before building)
├── app.json              # Expo config
├── babel.config.js
└── package.json
```

## Setup

```bash
cd mobile
npm install
```

## Running

```bash
npm start        # Expo Go on your phone (scan QR)
npm run ios      # iOS Simulator
npm run android  # Android Emulator / device
```

## API connection

Set `EXPO_PUBLIC_API_URL` to your backend URL:
- **Dev:** your machine's LAN IP, e.g. `http://192.168.1.x:8000`
- **Prod:** Cloud Run URL, e.g. `https://verbatim-api-xxxx.run.app`

Create a `.env.local` in `mobile/` (gitignored):
```
EXPO_PUBLIC_API_URL=http://192.168.1.x:8000
```

## Next steps (before App Store)

- Add `assets/icon.png` (1024×1024)
- Add `assets/splash.png` (1242×2436)
- Configure EAS Build (`eas.json`) for Expo Application Services
- Add push notifications via `expo-notifications`
- Add `expo-secure-store` for JWT token persistence
