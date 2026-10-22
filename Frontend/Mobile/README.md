# FixFlow Mobile

React Native + Expo client for FixFlow (facility / maintenance reporting).

## Stack

- Expo ~57, expo-router (file-based routing)
- NativeWind v4 (Tailwind) + `constants/theme.ts` for mode-aware colors
- i18next + react-i18next (en/zh, persisted to SecureStore)
- expo-secure-store for credential persistence + session keep-alive

## Run

```sh
npm install
npx expo start          # dev server
npx expo start --web    # web preview
```

The API base URL comes from `constants/config.ts` (`EXPO_PUBLIC_API_URL` or LAN discovery). For device testing the backend must be reachable over plain HTTP from the device, so `SESSION_COOKIE_SECURE` must stay false on the backend.

## Test

```sh
npm test            # vitest unit suite + node:test security suite
npx tsc --noEmit    # typecheck
```

## Build (preview APK)

Requires an Expo login and a running backend + MinIO:

```sh
eas build --profile preview
```

`eas.json` already defines the `preview` profile (internal distribution, Android APK).

## Backend dependencies

- Backend on `:8080` (`Backend/` — Spring Boot)
- MinIO for report photos (`fixflow.minio.*` env vars — see `Backend/src/main/resources/application.yaml`)

## Demo

See `.trae/documents/demo-script.md` for the per-role walkthrough and screenshot checklist.
