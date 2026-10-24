# Keystore de release (instrucciones)

**El keystore NUNCA se commitea** (`*.jks` / `*.keystore` están en `.gitignore` y `guard-secrets` falla si aparecen en git). Este directorio solo contiene estas instrucciones.

> ⚠️ **Si pierdes el keystore o sus contraseñas no podrás publicar actualizaciones firmadas**: Android rechaza instalar una APK firmada con otra clave sobre la app ya instalada, y habría que desinstalar y perder los datos locales. Guarda **siempre** una copia del archivo y de las contraseñas en tu gestor de contraseñas.

## 1. Generar el keystore (una sola vez, en local)

```bash
keytool -genkeypair -v \
  -keystore 027apps-release.jks \
  -alias 027apps \
  -keyalg RSA -keysize 4096 \
  -validity 10000
```

`keytool` pedirá la contraseña del keystore, la de la clave y datos del certificado. Validez de 10000 días (~27 años).

## 2. Guardar la copia de seguridad

Adjunta `027apps-release.jks` y las dos contraseñas + el alias (`027apps`) en tu gestor de contraseñas.

## 3. Subir a GitHub Secrets

```bash
gh secret set ANDROID_KEYSTORE_BASE64 --repo rferic/027apps < <(base64 < 027apps-release.jks)
gh secret set ANDROID_KEYSTORE_PASSWORD --repo rferic/027apps
gh secret set ANDROID_KEY_ALIAS --repo rferic/027apps --body 027apps
gh secret set ANDROID_KEY_PASSWORD --repo rferic/027apps
```

Los comandos sin `--body` ni redirección piden el valor por stdin (no queda en el historial del shell).

## 4. Borrar la copia local

Tras verificar que el backup está en el gestor de contraseñas, borra `027apps-release.jks` del disco (o déjalo fuera del repo).

## Cómo se usa

`app/build.gradle.kts` firma `assembleRelease` solo si existen las 4 variables de entorno (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). Sin ellas genera `app-release-unsigned.apk`. Flujo completo en [`docs/flows/cicd.md`](../../../docs/flows/cicd.md).
