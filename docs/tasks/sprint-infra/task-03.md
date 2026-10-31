---
id: sprint-infra-task-03
titulo: Environment release + keystore + secrets APK
area: infra
estado: en curso
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/flows/cicd.md §A.3-9
---

**Tarea**: crear el Environment `release` (con required reviewers) y subir los secrets de firma del APK (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`), tras proteger `main` y tags (orden obligatorio §A). Generar el keystore en local, guardar copia en el gestor de contraseñas, subir secrets, borrar el `.jks` local. Puerta de setup del usuario. Detalle y comandos en `apps/android/keystore/README.md`.

## Bitácora (2026-10-31)

- **Orden anti-exfiltración verificado antes de tocar nada** (§A del plan): `main` protegido con ruleset activo (task-01) y tags `v*` con bypass solo admin (task-02). Ambos aplicados y probados el 2026-10-27.
- **Environment `release` creado por el agente** (`gh api environments`): `required_reviewers = rferic` (id 14909550 → 14909500), sin política de ramas (los secrets del env solo se exponen a jobs del workflow `release`, disparado por tags `v*` que solo el admin puede crear). La API de GitHub no permite auto-aprobación: nadie puede mergear despliegues del env sin un revisor externo o con el propio usuario como revisor aceptado desde el UI de Actions.
- **Pendiente (usuario, comandos en `apps/android/keystore/README.md`)**:
  1. `keytool -genkeypair` (interactivo: contraseñas las elige él, nunca pasan por el agente).
  2. Copia del `.jks` + 2 contraseñas + alias al gestor de contraseñas.
  3. `gh secret set ... --env release` con los 4 secrets (stdin, sin historial).
  4. Aviso al agente → verificación con `gh secret list --env release` (solo nombres).
  5. Borrar el `.jks` local **solo** tras confirmar el paso 2 y verificar el paso 4.
- **Primer release real**: se demuestra con el primer tag funcional (cierre de sprint-05+); hoy el job `release` falla de forma intencionada sin keystore (design).
