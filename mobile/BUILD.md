# Mobile App — Desarrollo

## Stack

- **Framework:** Expo SDK 56 (React Native 0.85)
- **Navegación:** Expo Router (file-based)
- **Estilos:** NativeWind (Tailwind CSS v4)
- **API Client:** ts-rest con contratos compartidos (`packages/contracts/`)
- **Auth:** Supabase JS client + SecureStore
- **i18n:** i18next + expo-localization (6 idiomas)
- **Push:** expo-notifications
- **Tests:** Vitest + testing-library/react-native

## Estructura

```
mobile/
├── app/              ← Expo Router (file-based routing)
│   ├── _layout.tsx   ← Providers (Auth, Theme, i18n, módulos)
│   ├── index.tsx     ← Entry: version check → welcome/login/dashboard
│   ├── welcome.tsx   ← Onboarding (URL del servidor)
│   ├── login.tsx     ← Auth + biometría
│   ├── register.tsx  ← Registro (invitación)
│   ├── reset-password.tsx ← Deep link
│   └── (app)/        ← Shell autenticada (Tabs: Home, Apps, Settings)
│       ├── dashboard.tsx
│       ├── modules/  ← TODO + Inspiration + futuros
│       └── settings.tsx
├── src/
│   ├── lib/          ← supabase, auth, api, theme, i18n, notifications...
│   ├── hooks/        ← useAuth, useTranslation, useNotifications
│   ├── components/   ← ModuleCard, EmptyState, PillButton, etc.
│   ├── i18n/         ← JSONs de traducción (6 idiomas)
│   └── modules/      ← Registry con filtro beta/production
├── tests/            ← 46 tests (unit + componentes)
├── app.config.ts     ← Config dinámica por perfil (beta/production)
└── eas.json          ← Perfiles EAS (development, beta, preview, production)
```

## Arrancar en desarrollo

```bash
cd mobile

# 1. Asegurar que Supabase local corre
supabase start

# 2. Crear .env.local con las claves locales
# (ya creado, verificar que la IP sea correcta)
cat .env.local

# 3. Iniciar Expo
npx expo start
```

| Tecla | Acción |
|---|---|
| `i` | Abrir en simulador iOS |
| `a` | Abrir en emulador Android |
| `w` | Abrir en navegador (sin módulos nativos) |
| QR | Escanear con Expo Go en físico |

## Probar en simulador iOS (recomendado)

```bash
cd mobile && npx expo start
# Presiona 'i'
```

Ventajas: hot reload, SecureStore, biometría, notificaciones (simuladas).

## Probar en Expo Go (físico)

1. Instalar Expo Go desde App Store / Play Store
2. `cd mobile && npx expo start`
3. Escanear QR con la cámara

Límites: sin SecureStore (auth usa mock), sin biometría, sin push real.

## Development build (todos los módulos nativos)

Requiere cuenta Expo (gratuita): https://expo.dev

```bash
npx eas login
cd mobile && eas build --profile development --platform android
# Instalar APK, luego:
npx expo start
# Recarga en caliente con módulos nativos reales
```

## Build de release

Via GitHub Actions:
1. Ir a Actions → Mobile Build (APK)
2. Seleccionar `profile: beta` o `production`
3. Introducir versión (semver)
4. Ejecutar

El CI: build → descarga APK → sube a Supabase Storage → actualiza versión.

## Tests

```bash
cd mobile && npx vitest run     # Todos los tests
cd mobile && npx vitest          # Watch mode
```

## Variantes (Beta / Production)

| | Beta | Production |
|---|---|---|
| `EXPO_PUBLIC_APP_VARIANT` | `beta` | `production` |
| Nombre app | 027Apps Beta | 027Apps |
| Package | `com.rferic.apps027.beta` | `com.rferic.apps027` |
| URL default | Preview Vercel | `027apps.com` |
| Módulos beta | ✅ visibles | ❌ ocultos |
| OTA channel | `beta` | `production` |
