# Flujo: desarrollo local

Cómo configurar, arrancar y verificar el entorno de desarrollo local en 027Apps utilizando un dominio custom (`027apps.local`) con OrbStack y el proxy Caddy.

## Principios

1. El navegador nunca habla con Supabase de forma directa (todo el acceso ocurre de forma server-side a través de `@supabase/ssr` en el admin), por lo que no existe contenido mixto aunque se use `http://027apps.local`.
2. Las cookies de sesión y de idioma están ligadas al host exacto (`localhost` ↔ `027apps.local` ↔ `127.0.0.1`). Cambiar de host durante la sesión implica volver a iniciar sesión y volver a elegir idioma; se recomienda fijar un único host para toda la sesión de trabajo.
3. El puerto `3003` es el puerto de desarrollo del admin web, mientras que los puertos `80` y `443` los gestiona de forma nativa el proxy de OrbStack en macOS.

---

## 1. Requisitos previos

- **macOS** con **OrbStack** instalado y configurado:
  - En los ajustes de red de OrbStack, comprobar que está marcada la opción **"Allow access to container domains & IPs"**. Esto permite resolver dominios `.local` de contenedores en el host.
- **Node.js** y **pnpm** (versión indicada en `package.json`).
- **Supabase CLI** instalada.

---

## 2. Configuración de Supabase local

Para que Supabase acepte redirecciones y peticiones desde el dominio local, la sección `[auth]` en `supabase/config.toml` debe incluir:

```toml
[auth]
site_url = "http://027apps.local"
additional_redirect_urls = ["http://027apps.local", "http://localhost:3003", "http://127.0.0.1:3003"]
```

Para aplicar los cambios sin perder datos de la base de datos (los volúmenes se conservan):

```bash
supabase stop && supabase start
```

---

## 3. Arranque del servidor de desarrollo

El admin web de 027Apps se ejecuta por defecto en el puerto `3003`:

```bash
PORT=3003 pnpm --filter admin dev
```

> **Nota sobre puertos únicos:** dos worktrees distintos no pueden utilizar el puerto `3003` simultáneamente. Si se ejecuta más de un entorno a la vez, cada uno debe asignar un puerto diferente (p. ej. `PORT=3004`) y su propio proxy asociado.

---

## 4. Arranque y parada del proxy de desarrollo (Caddy + OrbStack)

Dado que en macOS el puerto `80` está ocupado por el runtime de OrbStack, se levanta un contenedor ligero de Caddy que actúa como reverse proxy hacia el puerto `3003` de la máquina anfitriona.

### Por qué la URL no lleva puerto
El contenedor de Caddy escucha en el puerto `80` (el puerto estándar por defecto para HTTP) y redirige de forma transparente todo el tráfico recibido hacia `host.docker.internal:3003`, donde opera el servidor de desarrollo de Next.js. Debido a esto, el navegador visualiza y solicita limpiamente `http://027apps.local`, sin necesidad de especificar `:3003` en la URL. Por esta misma razón, al configurar la `public_url` en el asistente de instalación utilizando este proxy, la dirección correcta a introducir es `http://027apps.local` y no `http://027apps.local:3003` (aunque sintácticamente ambos formatos sean aceptados por la validación de orígenes locales).

### Arranque
```bash
docker run -d --name 027apps-dev-proxy --restart unless-stopped \
  -l dev.orbstack.domains=027apps.local \
  -l dev.orbstack.http-port=80 \
  caddy:2-alpine caddy reverse-proxy --from :80 --to host.docker.internal:3003
```

> *Si `host.docker.internal` no resuelve en tu entorno Linux/macOS según la configuración de red, añade el flag `--add-host host.docker.internal:host-gateway` al comando anterior.*

### Parada y limpieza
```bash
docker rm -f 027apps-dev-proxy
```

---

## 5. Verificación

Comprobar que el proxy responde correctamente con un código `200` en la ruta de instalación:

```bash
curl -s -o /dev/null -w "%{http_code}" http://027apps.local/setup
```

Si el comando devuelve `200`, el flujo de desarrollo local está operativo. Si devuelve error de resolución (`Could not resolve host: 027apps.local`), verificar que OrbStack está activo y la opción de red de dominios permitidos está habilitada, y recrear el contenedor del proxy.

---

## 6. Solución de problemas comunes

| Incidencia | Causa probable | Solución |
|---|---|---|
| La página no hidrata (el selector de idioma o los botones no responden) | Bloqueo de assets estáticos o HMR de Next.js por origen desconocido. | Comprobar que `allowedDevOrigins` en `next.config.ts` incluye `027apps.local`, y recargar con `Cmd + Shift + R`. |
| Error `Could not resolve host: 027apps.local` | OrbStack no tiene habilitado el acceso a dominios de contenedores o el proxy no arrancó. | Revisar ajustes de red de OrbStack y relanzar el comando `docker run` de Caddy. |
| Sesión o idioma "perdidos" al abrir la app | Cambio de host (ej. de `localhost:3003` a `027apps.local`). | Las cookies están asociadas al dominio. Trabajar siempre sobre el mismo dominio (`http://027apps.local`). |
| El correo de prueba del asistente falla | Configuración SMTP o validación de Supabase. | El asistente usa `POST /api/v1/setup/test-email` llamando a `resetPasswordForEmail` sin `redirectTo`, por lo que Supabase recurre a `site_url`. El panel solo dispone de `/login` (no existe ruta `/recover`): el correo valida el funcionamiento SMTP, no un enlace de recuperación. |

---

## 7. Por qué `.local` y no `.test`

OrbStack resuelve dominios personalizados automáticamente **únicamente bajo la extensión `.local`**, utilizando sus labels de integración (`dev.orbstack.domains`). Por esta razón:
- Los dominios `.local` se emplean para el proxy web de desarrollo local con OrbStack.
- Los dominios `.test` (y otros dominios locales estándar) son perfectamente válidos y aceptados por la política estricta de `public_url` en `packages/core/src/settings/catalog.ts`, pero no pueden ser enrutados automáticamente por el proxy DNS de OrbStack en el puerto 80/443.

---

## Referencias

- Spec de diseño: `docs/superpowers/specs/2026-11-06-local-dev-domain-design.md`
- Plan de implementación: `docs/superpowers/plans/2026-11-06-local-dev-domain.md`
- Flujos relacionados: `docs/flows/cicd.md`, `docs/flows/i18n.md`

## Nunca ejecutes `next build` con el dev server levantado

`pnpm --filter admin build` escribe en `apps/admin/.next`, el mismo directorio que usa `next dev`.
Si el dev server está corriendo, el build lo deja en un estado inconsistente: el proceso sigue vivo y
acepta conexiones, pero **no responde** (ni por `localhost` ni por la IP de la LAN), y al intentar
relanzarlo Next avisa de que ya hay un servidor en ese puerto.

Síntoma típico: el móvil se queda cargando y `curl http://<ip>:3003/login` se agota sin respuesta.

Secuencia correcta:

1. Para el dev server: `lsof -nP -iTCP:3003 -sTCP:LISTEN -t` y `kill <pid>`.
2. `pnpm --filter admin build`.
3. Relanza: `PORT=3003 pnpm --filter admin dev`.

Si ya se ha roto: `pkill -9 -f "next dev"` y `rm -rf apps/admin/.next`, y vuelve a arrancar.
