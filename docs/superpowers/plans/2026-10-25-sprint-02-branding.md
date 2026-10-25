# Plan — Sprint 02, Task 01: Branding completo

Spec: `docs/superpowers/specs/2026-10-25-027apps-branding.md` · Base: identidad D (ADR 0002)

- [x] **Step 1: Puerta de elección del logo**

Mockup `docs/brand/mockups/logo.html` con 3 direcciones (L1 anillo, L2 punto terminal, L3 mesa familiar), cada una con: wordmark en claro y oscuro, símbolo standalone, icono de app, prueba de 16/24/32 px y preview de splash. El usuario redirigió a la idea del legacy (latido) y se construyó L4 (`docs/brand/mockups/logo-l4.html`); la eligió.

- [x] **Step 2: ADR 0003 y dirección final**

ADR 0003 registra la elección. La variante simplificada para tamaños pequeños es «solo latido» (`mark.svg`), documentada en `docs/brand/brand.md`.

- [x] **Step 3: Assets finales**

- `apps/admin/src/app/icon.svg` + `favicon.ico` + `apple-icon.png` (set web del admin)
- `docs/brand/assets/`: logo wordmark claro/oscuro/mono (completos y *bare*), icono claro/oscuro, marca suelta y foreground Android, generados con texto convertido a paths por `scripts/brand/build-assets.py`
- `apps/android/`: adaptive icon (foreground vector + background color), mipmaps 48/72/96/144/192, Play Store 512 en `docs/brand/assets/`, splash con color de fondo claro/oscuro
- `docs/brand/brand.md`: usos, no-hacer, cleared space, tamaños mínimos

- [x] **Step 4: Verificar**

`pnpm lint && pnpm tsc && pnpm test` y `pnpm --filter admin build` en verde con salida leída; `./gradlew :app:assembleDebug` y `:app:testDebugUnitTest` en verde. Revisión de estilo (enfermero) y auditoría de seguridad (ingeniero) por agentes distintos del autor: hallazgos corregidos (teal claro alineado a `#09795F`, PNG a 8-bit, tema base Android, docs) o documentados (F-04/F-05 a backlog).

- [ ] **Step 5: Commit**

Commits separados: `docs(brand): ...` para elección/ADR/brand.md, `feat(admin): ...` para el set web, `feat(android): ...` para icono y splash.
