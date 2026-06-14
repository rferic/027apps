---
name: frontend-test
description: Verify frontend and API functionality across local, preview, and production environments. Use when asked to "test the frontend", "verify deployment", "check if everything works", "run e2e tests", or after a deploy/merge. Automatically adapts to the environment (production is read-only).
allowed-tools: Bash(curl *), Bash(git *), Bash(grep *), Bash(python3 *), Bash(rm *)
---

# Frontend Test — Skill de verificación

Verifica el correcto funcionamiento del frontal y la API en cualquier entorno.

## 🔐 Configuración (una vez)

Las credenciales se almacenan en `~/.config/opencode/e2e-config.json` (FUERA del repo).
Si no existe, la skill pregunta los datos en el momento y los guarda.

## 🚀 Uso

```
@opencode test-frontend [local|preview|production]
```

Si no se especifica entorno, pregunta.

## 📋 Tests por entorno

| Test | Local | Preview | Producción |
|---|---|---|---|
| Health check | ✅ | ✅ | ✅ |
| Páginas SSR | ✅ | ✅ | ✅ |
| API autenticada | ✅ | ✅ | ✅ |
| App Inspiration | ✅ | ✅ | ❌ solo GET |
| App Todo | ✅ | ✅ | ❌ solo GET |
| App Split Expenses | ✅ | ✅ | ❌ solo GET |
| Admin endpoints | ✅ | ✅ | ❌ solo GET |
| Server-Timing headers | ✅ | ✅ | ✅ |
| Sin errores 404/500 | ✅ | ✅ | ✅ |

## Workflow

### Paso 1 — Leer configuración

```bash
CONFIG="$HOME/.config/opencode/e2e-config.json"
if [ ! -f "$CONFIG" ]; then
  echo "ERROR: No config found at $CONFIG"
  echo "Run 'skill frontend-test setup' first or provide credentials."
  exit 1
fi
```

### Paso 2 — Determinar entorno

Si no se pasó como argumento, preguntar al usuario:

```
¿Qué entorno quieres testear?
1) Local (http://localhost:3000)
2) Preview (rama actual → URL automática)
3) Producción (solo lectura)
```

Para **preview**, detectar la rama actual:

```bash
BRANCH=$(git branch --show-current)
# Convertir branch name a URL-safe: sprint/26-performance → sprint-26-performance
SAFE_BRANCH=$(echo "$BRANCH" | sed 's/\//-/g')
PREVIEW_URL=$(echo "$TEMPLATE" | sed "s/{branch}/$SAFE_BRANCH/")
```

### Paso 3 — Login

Obtener token JWT del Supabase correspondiente:

```bash
SUPABASE_URL=$(jq -r ".supabase.$ENV.url" "$CONFIG")
ANON_KEY=$(jq -r ".supabase.$ENV.anonKey" "$CONFIG")
EMAIL=$(jq -r ".credentials.email" "$CONFIG")
PASSWORD=$(jq -r ".credentials.password" "$CONFIG")

TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | \
  python3 -c "import sys,json; t=json.load(sys.stdin); print(t.get('access_token',''))" 2>/dev/null)
```

### Paso 4 — Health check

```bash
BASE=$(jq -r ".urls.$ENV" "$CONFIG")
echo "=== Health check ==="
# API root
code=$(curl -sL -o /dev/null -w "%{http_code}" "$BASE/api/v1" 2>/dev/null)
echo "  GET /api/v1 → $code"
```

### Paso 5 — Páginas SSR

```bash
pages=("/en/login" "/en/doc" "/en/admin")
for pg in "${pages[@]}"; do
  code=$(curl -sL -o /dev/null -w "%{http_code}" "$BASE$pg" 2>/dev/null)
  size=$(curl -sL -o /dev/null -w "%{size_download}" "$BASE$pg" 2>/dev/null)
  echo "  GET $pg → $code ($size bytes)"
done
```

### Paso 6 — API autenticada

```bash
AUTH="Authorization: Bearer $TOKEN"

endpoints=("/api/v1/me" "/api/v1/apps" "/api/v1/shared/config")
for ep in "${endpoints[@]}"; do
  code=$(curl -sL -o /dev/null -w "%{http_code}" -H "$AUTH" "$BASE$ep" 2>/dev/null)
  st=$(curl -sL -D - -H "$AUTH" "$BASE$ep" 2>/dev/null | grep -i x-handler-time | tr -d '\r')
  echo "  GET $ep → $code  $st"
done
```

### Paso 7 — Apps (Todo)

```bash
GROUP=$(jq -r ".groups.test" "$CONFIG")
read_only=$([ "$ENV" = "production" ] && echo "true" || echo "false")

# GET items (todos los entornos)
code=$(curl -sL -o /dev/null -w "%{http_code}" -H "$AUTH" "$BASE/api/v1/$GROUP/apps/todo/items" 2>/dev/null)
items=$(curl -sL -H "$AUTH" "$BASE/api/v1/$GROUP/apps/todo/items" 2>/dev/null | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[]) if isinstance(d,dict) else d))" 2>/dev/null)
echo "  GET /apps/todo/items → $code ($items items)"

# POST crear item (solo local/preview)
if [ "$read_only" != "true" ]; then
  id=$(curl -sL -H "$AUTH" -X POST "$BASE/api/v1/$GROUP/apps/todo/items" \
    -H "Content-Type: application/json" \
    -d '{"title":"[test] Frontend verification '$ENV'","visibility":"private"}' 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
  echo "  POST /apps/todo/items → created: ${id:0:8}..."
fi
```

### Paso 8 — App Inspiration

```bash
code=$(curl -sL -o /dev/null -w "%{http_code}" -H "$AUTH" "$BASE/api/v1/$GROUP/apps/inspiration?limit=1" 2>/dev/null)
items=$(curl -sL -H "$AUTH" "$BASE/api/v1/$GROUP/apps/inspiration?limit=1" 2>/dev/null | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
echo "  GET /apps/inspiration → $code ($items ideas)"
```

### Paso 9 — Admin endpoints

```bash
admin_endpoints=("/api/v1/admin/groups" "/api/v1/admin/settings")
for ep in "${admin_endpoints[@]}"; do
  code=$(curl -sL -o /dev/null -w "%{http_code}" -H "$AUTH" "$BASE$ep" 2>/dev/null)
  echo "  GET $ep → $code"
done
```

### Paso 10 — Verificar Server-Timing header

```bash
missing=0
for ep in "/api/v1" "/api/v1/locales" "/api/v1/me"; do
  has=$(curl -sL -D - -H "$AUTH" "$BASE$ep" 2>/dev/null | grep -ci "x-handler-time")
  if [ "$has" = "0" ]; then missing=$((missing + 1)); fi
done
echo "  Endpoints sin X-Handler-Time: $missing"
```

### Paso 11 — Limpiar datos de prueba

En local/preview, si se crearon datos de prueba, eliminarlos:

```bash
if [ "$read_only" != "true" ] && [ -n "$created_id" ]; then
  curl -sL -X DELETE -H "$AUTH" "$BASE/api/v1/$GROUP/apps/todo/items/$created_id" > /dev/null 2>&1
  echo "  Cleanup: deleted test item ${created_id:0:8}..."
fi
```

### Paso 12 — Reporte final

```bash
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║  Frontend Test — $ENV              ║"
echo "╚════════════════════════════════════════════════════╝"
echo "  Fecha: $(date)"
echo "  Resultado: TODO OK / ERRORES"
echo ""
```

## 📝 Notas

- **Producción** = solo lectura. No se crean, modifican ni eliminan datos.
- **Local** = necesita `supabase start` y `pnpm dev` corriendo.
- **Preview** = necesita rama pusheada y Vercel deployment completado.
- Los tokens JWT se descartan tras la ejecución.
- Si el login falla, probablemente el anon key no corresponde al entorno.
