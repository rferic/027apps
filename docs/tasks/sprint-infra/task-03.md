---
id: sprint-infra-task-03
titulo: Environment release + keystore + secrets APK
area: infra
estado: finalizada
plan: docs/superpowers/plans/2026-10-27-sprint-infra.md
fuente: docs/flows/cicd.md §A.3-9
---

**Tarea**: crear el Environment `release` (con required reviewers) y subir los secrets de firma del APK (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`), tras proteger `main` y tags (orden obligatorio §A). Generar el keystore en local, guardar copia en el gestor de contraseñas, subir secrets, borrar el `.jks` local. Puerta de setup del usuario. Detalle y comandos en `apps/android/keystore/README.md`.

## Bitácora (2026-10-31 – 2026-11-01)

- **Orden anti-exfiltración verificado antes de tocar nada** (§A del plan): `main` protegido con ruleset activo (task-01) y tags `v*` con bypass solo admin (task-02). Ambos aplicados y probados el 2026-10-27.
- **Environment `release` creado por el agente** (`gh api environments`): `required_reviewers = rferic` (id 14909550 → 14909500), sin política de ramas (los secrets del env solo se exponen a jobs del workflow `release`, disparado por tags `v*` que solo el admin puede crear). La API de GitHub no permite auto-aprobación: nadie puede mergear despliegues del env sin un revisor externo o con el propio usuario como revisor aceptado desde el UI de Actions.
- **Keystore generado por el agente** (2026-11-01) con `keytool` (RSA 4096, validez 10000 días, alias `027apps`, DN `CN=027apps, O=027Apps, C=ES`) y contraseña aleatoria fuerte generada con `openssl rand`. El keystore es PKCS12: usa una sola contraseña para almacén y clave (`keytool` ignora un `-keypass` distinto). Los 4 secrets se subieron al Environment `release` leyendo de ficheros locales; los valores nunca pasaron por el chat. Verificado con `gh secret list --env release` (solo nombres).
- **Keystore canónico: `private/keystore/027apps-release.jks`** (SHA1 `F0:A5:D0:38:87:91:02:0C:A6:99:15:96:5F:41:19:A6:23:A1:9B:61`). El intento anterior en `private/android/` (SHA1 `05:C0:03:5D:...`, generado 06:11 UTC) se descartó y **se borró** el 2026-11-01 tras consolidar el nuevo. La nota de Firebase se actualizó al SHA1 nuevo.
- **Pendiente (usuario, móvil hasta nuevo aviso)**:
  1. Guardar en el gestor de contraseñas el fichero `private/keystore/027apps-release.jks` y las contraseñas de `private/keystore/credentials.txt`.
  2. Avisar al agente para borrar la carpeta `private/keystore/` completa.
  3. Hasta entonces, los ficheros permanecen en el disco con permisos 600/700. La carpeta `private/` está ignorada por git (`private/README.md`) y **no es un backup**: `git clean -xdf` la borraría.
- **Cerrada por el usuario** (2026-11-01): confirma que guarda el keystore y las contraseñas en su gestor; el borrado local de `private/keystore/` queda **en su mano** (lo hará cuando le venga bien, sin bloquear nada). El agente no la borra. Recordatorio operativo: si el usuario ejecuta `git clean -xdf` o borra la carpeta manualmente sin copia previa, el keystore solo se recupera de su gestor de contraseñas.
- **Primer release real**: se demuestra con el primer tag funcional (cierre de sprint-05+); hoy el job `release` falla de forma intencionada sin keystore (design).
