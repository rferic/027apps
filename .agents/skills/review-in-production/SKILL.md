---
name: review-in-production
description: Verify that the production deployment on Vercel is working correctly. Includes health checks, build verification, auth testing, navigation, logs inspection, manual checklist, and rollback guidance. Use after a production deploy or when asked to "review production", "check deployment", "verify production", or "production health check".
allowed-tools: Bash(curl *), Bash(npx vercel *), Bash(npx playwright test *), Bash(gh *)
---

# review-in-production

Skill mixta: verificaciones automáticas + checkpoints de confirmación manual.

## Workflow

### 1. Health check HTTP

```bash
curl -s -o /dev/null -w "%{http_code}" https://027apps-eric-rf.vercel.app/
```

Debe responder `200`. Si no, parar e informar.

```bash
curl -s -o /dev/null -w "%{http_code}" https://027apps-eric-rf.vercel.app/es/login
```

Debe responder `200`.

### 2. Build check

```bash
npx vercel list --token <token> 2>&1 | head -20
```

Verificar el último deploy: status debe ser `READY`, sin errores de build.

### 3. Auth funcional

Hacer una prueba de login contra producción:

```bash
curl -s -X POST "https://zbwvvzeljiymwqcbemyy.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"<test-user>","password":"<test-password>"}'
```

Verificar que devuelve un `access_token`.

### 4. Navegación crítica

Verificar que estas rutas responden 200:

- `GET /` → 200
- `GET /en/login` → 200
- `GET /en/admin` → 200 (o redirect a login si no autenticado)
- `GET /en/doc` → 200

### 5. Logs de Vercel

```bash
npx vercel logs --token <token> 2>&1 | tail -30
```

Revisar runtime logs buscando: `Error`, `Unhandled Rejection`, `500`, `404` (inesperados).

### 6. Checklist manual

Presentar al usuario:

> **Verificación manual — revisa lo siguiente en production:**
>
> - [ ] Login funciona: `/en/login` → ingresar credenciales → redirige correctamente
> - [ ] Admin panel carga: `/en/admin` muestra el dashboard sin errores
> - [ ] Las apps instaladas se ven y funcionan
> - [ ] Los enlaces de navegación funcionan (header, bottom nav)
> - [ ] No hay errores visibles en la consola del navegador (F12)
> - [ ] El diseño se ve bien en mobile (responsive)

Esperar a que el usuario confirme cada item.

### 7. Rollback guiado (si algo falla)

Si alguna verificación falla:

```bash
# Listar deploys anteriores
npx vercel list --token <token>

# Hacer rollback a un deploy específico
npx vercel rollback <deploy-id> --token <token>
```

**Preguntar al usuario:**
> "Se ha detectado un error en [detalle]. ¿Quieres que haga rollback al deploy anterior?"

Solo proceder si confirma.
