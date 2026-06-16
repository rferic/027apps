# Operaciones — 027apps

## Entornos

| Entorno | URL | Supabase |
|---|---|---|
| **Local** | `http://localhost:3000` | Local (`http://localhost:54321`) |
| **Preview** | `https://027apps-git-{branch}-eric-rf.vercel.app` | Staging (`tsphkmbtnahjgsivdhaj`) |
| **Producción** | `https://027apps-eric-rf.vercel.app` | Producción (`zbwvvzeljiymwqcbemyy`) |

## Keep-warm

Para evitar el cold start de Vercel (función serverless se duerme tras ~5 min sin tráfico), se usa un cron externo gratuito:

- **Servicio:** [cron-job.org](https://cron-job.org)
- **URL:** `https://027apps-eric-rf.vercel.app/api/v1/locales`
- **Intervalo:** cada 5 minutos
- **Coste:** 0€ (plan gratuito)

Cuando el endpoint `GET /api/health` esté disponible en producción (Sprint 27), cambiar la URL a:
`https://027apps-eric-rf.vercel.app/api/health`

### Gestión

- **Activar/desactivar:** Entrar a cron-job.org → Cronjobs → toggle "Pause/Resume"
- **Ver historial:** cron-job.org → Cronjobs → "Show details" → "Logs"
- **Si el endpoint falla:** cron-job.org notifica por email

## Tests de frontend

```bash
@opencode test-frontend [local|preview|production]
```

Verifica: health check, páginas SSR, API autenticada, apps, admin, Server-Timing.

- **Producción:** solo lectura (GET, no crea/modifica/elimina datos)
- **Local/Preview:** permite escritura (crea y limpia datos de prueba)

## Credenciales

Las claves sensibles están en `~/.config/opencode/e2e-config.json` (FUERA del repo):

| Dato | Descripción |
|---|---|
| `credentials.email` | Email para login de tests |
| `credentials.password` | Contraseña |
| `supabase.local` | Anon key de Supabase local |
| `supabase.preview` | Anon key de Supabase staging |
| `supabase.production` | Anon key de Supabase producción |
| `urls.*` | URLs de cada entorno |
| `groups.*` | Group slug por entorno |

## Comandos útiles

```bash
# Desarrollo local
supabase start          # Iniciar Supabase local
pnpm dev                # Iniciar Next.js dev server

# Build
pnpm build              # Build completo (registry + next build)

# Tests
pnpm lint               # ESLint
pnpm tsc --noEmit       # TypeScript check
pnpm test --run         # Tests unitarios

# Migraciones
supabase db push --local                  # Aplicar migraciones a local
supabase link --project-ref zbwvv...      # Vincular a producción
supabase db push --include-all            # Aplicar migraciones a producción
```
