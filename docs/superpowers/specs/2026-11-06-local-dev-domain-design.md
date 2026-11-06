# Spec — Dominio local de desarrollo (027apps.local) y public_url local

**Fecha:** 2026-11-06 · **Estado:** Aprobado (2026-11-06)
**Base:** `docs/flows/local-development.md`, `packages/core/src/settings/catalog.ts`, `apps/admin/next.config.ts`, `supabase/config.toml`

## 1. Objetivo

Permitir el desarrollo y pruebas locales del panel de administración y el asistente de instalación bajo el dominio amigable `http://027apps.local`, adaptando la validación del esquema de URLs públicas para aceptar protocolos `http` en entornos locales seguros (como `.local` o `.test`) sin comprometer los requisitos de seguridad en producción.

## 2. Por qué

- Trabajar directamente sobre puertos numéricos (`localhost:3003` o `127.0.0.1:3003`) dificulta la simulación fiel de despliegues basados en dominios y cookies seguras.
- OrbStack en macOS facilita el uso de dominios `.local` mapeados automáticamente al puerto 80/443 mediante labels de contenedores, requiriendo un proxy inverso ligero (Caddy).
- La validación estricta anterior exigía estricta conformidad con `https` para cualquier `public_url`, lo que bloqueaba la configuración en instancias locales puramente HTTP.

## 3. Alcance

**Dentro:**
- Actualización de `next.config.ts` y su test asociado (`dev-origins.test.ts`) para incluir `027apps.local` en `allowedDevOrigins`.
- Modificación de la política `publicUrlSchema` en `packages/core/src/settings/catalog.ts` (Política A2) para permitir `https` en cualquier host y `http` exclusivamente en hosts locales reconocidos (`localhost`, dominios con sufijo `.localhost`, `.local`, `.test`, `127.0.0.1`, `[::1]`, rangos privados `10.x`, `172.16-31.x`, `192.168.x`), validados como orígenes puros (sin barra final, path o query; puerto opcional válido).
- Actualización de `supabase/config.toml` con `site_url = "http://027apps.local"` y URLs de redirección.
- Mejora de `preferences-step.tsx` con validación de patrones HTML (`pattern="https?://[^\s/]+"`) y traducción en 9 locales.
- Documentación del flujo completo en `docs/flows/local-development.md`.
- Creación de la tarea `sprint-06-task-03`.

**Fuera:**
- Commitear ficheros docker-compose o scripts de automatización del proxy Caddy al repositorio (se documenta su ejecución manual mediante `docker run`).
- Modificar políticas de seguridad de producción en entornos cloud.

## 4. Enfoque elegido y alternativas descartadas

- **Enfoque elegido:** Contenedor Caddy transitorio gestionado por labels de OrbStack para redirigir el tráfico del puerto 80 al 3003 de la app, combinado con una política flexible de `public_url` en el Core y la inclusión explícita en `allowedDevOrigins`.
- **Alternativa descartada:** Modificar `/etc/hosts` manualmente para cada desarrollador y gestionar certificados autofirmados complejos para HTTPS local, descartada por su alta fricción operativa y mantenimiento manual.

## 5. Contrato técnico de la política `public_url` (Política A2)

- Esquema permitido: `https` en cualquier FQDN válido.
- Esquema `http`: permitido **únicamente** si el hostname coincide con alguna de las siguientes expresiones de seguridad local:
  - `localhost` o subdominios (`*.localhost`)
  - Dominios locales de prueba o desarrollo (`*.local`, `*.test`)
  - Loopback IPv4 (`127.0.0.1`) o IPv6 (`[::1]`)
  - Redes privadas IPv4 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- Formato: origen puro. No se permiten barras finales (`/`), rutas (`/path`) ni parámetros de consulta (`?query`). Se permite puerto opcional (ej. `:3003`).

## 6. Criterios de aceptación

- `curl -s -o /dev/null -w "%{http_code}" http://027apps.local/setup` devuelve `200`.
- Los tests unitarios de `catalog.test.ts` y `dev-origins.test.ts` pasan satisfactoriamente.
- `supabase/config.toml` refleja adecuadamente el dominio local.
- La documentación del flujo de desarrollo local está completa y escrita en español.
