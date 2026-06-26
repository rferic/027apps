# 027Apps Mobile — Build Guide

## Prerequisites

- Node.js 22+
- pnpm 10+
- EAS CLI: `npm install -g eas-cli`
- Expo account (free tier)
- Android Studio (for local builds)
- Xcode (macOS only, for iOS simulator)

## Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start Expo dev server
cd mobile && npx expo start

# Run on Android
cd mobile && npx expo start --android

# Run on iOS
cd mobile && npx expo start --ios

# Run type check
cd mobile && npx tsc --noEmit
```

## Build Profiles

Defined in `eas.json`:

| Profile      | Dev Client | Distribution | Build Type |
|-------------|-----------|-------------|------------|
| development | yes       | internal    | APK        |
| preview     | no        | internal    | APK        |
| production  | no        | —           | APK        |

## Building Locally

```bash
# Preview build (internal distribution)
cd mobile
eas build --platform android --profile preview

# Production build
cd mobile
eas build --platform android --profile production

# iOS build (preview)
cd mobile
eas build --platform ios --profile preview
```

## CI/CD Pipelines

### OTA Updates (`mobile-ota.yml`)
- Trigger: push to `main` with changes in `mobile/`
- Publishes OTA update to `production` channel
- Runs type check before publishing

### Native Builds (`mobile-build.yml`)
- Trigger: manual `workflow_dispatch`
- Requires: `version` tag and `profile` selection
- Builds APK via EAS Build

### PR Checks (`mobile-ci.yml`)
- Trigger: PR affecting `mobile/`
- Runs type check only

## Environment Secrets

Required GitHub Actions secrets:
- `EXPO_TOKEN` — Expo personal access token

## OTA Updates

Updates are configured in `app.json` under `expo.updates`:

```json
"updates": {
  "url": "https://u.expo.dev/REPLACE_WITH_PROJECT_ID"
}
```

Replace `REPLACE_WITH_PROJECT_ID` with your actual Expo project ID after running `eas init` or linking the project.
