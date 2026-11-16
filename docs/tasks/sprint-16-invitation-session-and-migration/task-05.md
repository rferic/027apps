---
id: sprint-16-task-05
titulo: App Links — fingerprint, redeploy y verificación en dispositivo
area: infra + app
estado: pendiente
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
adrs: [0010]
---

**Tarea**: conseguir que el enlace `https://027apps.ericrf.com/invite/<token>` abra la app en un
dispositivo Android real. Sin esto, el requisito app-first no se ve aunque el código esté bien.

**Punto de partida (verificado)**
- `assetlinks.json` responde `[]`; el APK v0.18.1 lleva el App Link y el esquema propio;
  `minSdkVersion=26`.
- `apps/admin/src/app/.well-known/assetlinks.json/route.ts` lee `ANDROID_APP_SHA256` separado por
  comas; sin variable, `[]`.
- Fingerprint del APK v0.18.1:
  `00:6A:22:FA:7A:A4:76:A5:5D:B7:C4:62:2E:FF:19:3F:76:4F:66:10:A3:6D:9C:D1:DF:CE:C8:03:AE:A1:39:C6`.

**Alcance**
- Dentro:
  - Verificar el certificado del APK que se instala (`apksigner verify --print-certs`).
  - P3: `ANDROID_APP_SHA256` en Vercel Production (y Preview si se prueba) y redeploy.
  - `curl` de `/.well-known/assetlinks.json` con el objeto esperado.
  - Añadir `pathPrefix="/migrate/"` al `intent-filter` de release (el `/invite/` ya está); el
    debug mantiene `027apps-dev://invite` y añade `027apps-dev://migrate` en la tarea 10.
  - Verificación en dispositivo: `pm get-app-links`, `pm verify-app-links --re-verify`, abrir el
    enlace del email.
  - `docs/flows/cicd.md`: documentar la variable y `/migrate/`.
- Fuera: cambiar la firma del APK; publicar una release nueva si el APK v0.18.1 sirve para el
  requisito de invitación (el QR sí exige el APK del sprint).

**Dependencias**: tarea 01; P3 y P4 del propietario. La verificación de la aceptación completa
depende de la 06.

**Riesgos**: que el fingerprint no sea el del APK instalado (verificar antes); que Android cachee
el `[]` (re-verificar); que el APK de debug no verifique el host (las pruebas de App Link son con
release); que el preview de Vercel no tenga la variable si se prueba allí.

**Criterios de aceptación**
- `assetlinks.json` devuelve el objeto con `package_name` y el fingerprint; no `[]`.
- `pm get-app-links com.rferic.zero27apps` muestra `verified` para `027apps.ericrf.com`.
- El enlace del email abre la app en el dispositivo real; un enlace web normal no.
- Evidencia pegada: `curl`, `pm`, captura del enlace abriendo la app.
- `docs/flows/cicd.md` actualizado.

**Puertas de usuario**
- Poner la variable en Vercel y redesplegar (P3).
- Facilitar el dispositivo real (P4).
- Confirmar el fingerprint si se rota la firma.

**Auditoría de seguridad**: obligatoria antes de `finalizada` (A05, A11): fingerprint público, sin
keystore en git, HTTPS y path filters.
