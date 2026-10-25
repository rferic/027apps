---
id: sprint-infra-task-03
titulo: Environment release + keystore + secrets APK
area: infra
estado: pendiente
fuente: docs/flows/cicd.md §A.3-9
---

**Tarea**: crear el Environment `release` (con required reviewers) y subir los secrets de firma del APK (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`), tras proteger `main` y tags (orden obligatorio §A). Generar el keystore en local, guardar copia en el gestor de contraseñas, subir secrets, borrar el `.jks` local. Puerta de setup del usuario. Detalle y comandos en `apps/android/keystore/README.md`.
