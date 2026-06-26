---
name: frontend-test
description: Verify frontend and API functionality across local, preview, and production environments. Use when asked to "test the frontend", "verify deployment", "check if everything works", "run e2e tests", or after a deploy/merge. Automatically adapts to the environment (production is read-only).
allowed-tools: Bash(curl *), Bash(git *), Bash(grep *), Bash(python3 *), Bash(rm *), Bash(mv *), Bash(echo *)
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
| App Todo | ✅ | ✅ | ❌ solo GET |
| App Inspiration | ✅ | ✅ | ❌ solo GET |
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

Si no se pasó como argumento, preguntar al usuario. Para **preview**, detectar la rama actual:

```bash
ENV="$1"
if [ -z "$ENV" ]; then
  echo "¿Qué entorno?"
  echo "1) Local"
  echo "2) Preview (rama actual)"
  echo "3) Producción (solo lectura)"
  read -r ENV
fi

# Resolver URLs
BASE=$(python3 -c "import json; print(json.load(open('$CONFIG'))['urls']['$ENV'])")
GROUP=$(python3 -c "import json; print(json.load(open('$CONFIG'))['groups']['$ENV'])")
TEMPLATE=$(python3 -c "import json; print(json.load(open('$CONFIG'))['urls'].get('previewTemplate',''))")

if [ "$ENV" = "preview" ]; then
  BRANCH=$(git branch --show-current)
  SAFE_BRANCH=$(echo "$BRANCH" | sed 's/\//-/g')
  BASE=$(echo "$TEMPLATE" | sed "s/{branch}/$SAFE_BRANCH/")
fi
```

### Paso 3 — Login (guardar token en archivo temporal)

```bash
SUPABASE_URL=$(python3 -c "import json; print(json.load(open('$CONFIG'))['supabase']['$ENV']['url'])")
ANON_KEY=$(python3 -c "import json; print(json.load(open('$CONFIG'))['supabase']['$ENV']['anonKey'])")
EMAIL=$(python3 -c "import json; print(json.load(open('$CONFIG'))['credentials']['email'])")
PASSWORD=$(python3 -c "import json; print(json.load(open('$CONFIG'))['credentials']['password'])")

TOKEN_FILE="/tmp/fe_test_token.txt"
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | \
  python3 -c "import sys,json; t=json.load(sys.stdin); open('/tmp/fe_test_token.txt','w').write(t.get('access_token',''))" 2>/dev/null

TOKEN=$(cat "$TOKEN_FILE")
if [ -z "$TOKEN" ]; then echo "❌ Login failed"; exit 1; fi
echo "✅ Login ok (${#TOKEN} chars)"
AUTH="Authorization: Bearer $TOKEN"
```

### Paso 4 — Health check

```bash
echo ""
echo "=== Health check ==="
for ep in "/api/v1" "/api/v1/locales"; do
  code=$(curl -sL -o /dev/null -w "%{http_code}" "$BASE$ep" 2>/dev/null)
  echo "  GET $ep → $code"
done
```

### Paso 5 — Páginas SSR

```bash
echo ""
echo "=== Páginas SSR ==="
pages=("/en/login")
for pg in "${pages[@]}"; do
  code=$(curl -sL -o /dev/null -w "%{http_code}" "$BASE$pg" 2>/dev/null)
  size=$(curl -sL -o /dev/null -w "%{size_download}" "$BASE$pg" 2>/dev/null)
  echo "  GET $pg → $code ($size bytes)"
done
```

### Paso 6 — API autenticada

```bash
echo ""
echo "=== API autenticada ==="
for ep in "/api/v1/shared/config" "/api/v1/shared/profile"; do
  resp=$(curl -sL -D /tmp/fe_test_headers.txt -H "$AUTH" "$BASE$ep" 2>/dev/null)
  code=$(head -1 /tmp/fe_test_headers.txt | awk '{print $2}')
  st=$(grep -i x-handler-time /tmp/fe_test_headers.txt | sed 's/.*dur=//' | tr -d 'ms\r')
  echo "  GET $ep → $code  handler: ${st}ms"
done
```

### Paso 7 — App Todo

```bash
echo ""
echo "=== App Todo ==="
read_only=$([ "$ENV" = "production" ] && echo "true" || echo "false")
created_id=""

# GET items
resp=$(curl -sL -D /tmp/fe_test_headers.txt -H "$AUTH" "$BASE/api/v1/$GROUP/apps/todo/items" 2>/dev/null)
code=$(head -1 /tmp/fe_test_headers.txt | awk '{print $2}')
count=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[]) if isinstance(d,dict) else d))" 2>/dev/null)
echo "  GET /apps/todo/items → $code ($count items)"

# POST (solo local/preview)
if [ "$read_only" != "true" ]; then
  resp=$(curl -sL -H "$AUTH" -X POST "$BASE/api/v1/$GROUP/apps/todo/items" \
    -H "Content-Type: application/json" \
    -d '{"title":"[test] Frontend verification '$ENV'","visibility":"private"}' 2>/dev/null)
  created_id=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null)
  echo "  POST /apps/todo/items → ${created_id:0:8}..."
fi
```

### Paso 8 — App Inspiration

```bash
echo ""
echo "=== App Inspiration ==="
resp=$(curl -sL -D /tmp/fe_test_headers.txt -H "$AUTH" "$BASE/api/v1/$GROUP/apps/inspiration?limit=1" 2>/dev/null)
code=$(head -1 /tmp/fe_test_headers.txt | awk '{print $2}')
count=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null)
echo "  GET /apps/inspiration → $code ($count ideas)"
```

### Paso 9 — Admin endpoints

```bash
echo ""
echo "=== Admin ==="
for ep in "/api/v1/admin/groups" "/api/v1/admin/settings"; do
  code=$(curl -sL -o /dev/null -w "%{http_code}" -H "$AUTH" "$BASE$ep" 2>/dev/null)
  echo "  GET $ep → $code"
done
```

### Paso 10 — Server-Timing headers

```bash
echo ""
echo "=== Server-Timing ==="
missing=0
for ep in "/api/v1" "/api/v1/locales"; do
  has=$(curl -sL -D - -H "$AUTH" "$BASE$ep" 2>/dev/null | grep -ci "x-handler-time" 2>/dev/null)
  if [ "$has" = "0" ]; then missing=$((missing + 1)); fi
done
echo "  Endpoints sin header: $missing"
```

### Paso 11 — Limpiar

```bash
if [ "$read_only" != "true" ] && [ -n "$created_id" ]; then
  curl -sL -X DELETE -H "$AUTH" "$BASE/api/v1/$GROUP/apps/todo/items/$created_id" > /dev/null 2>&1
  echo "  Cleanup: deleted test item"
fi
rm -f "$TOKEN_FILE" /tmp/fe_test_headers.txt
```

### Paso 12 — Reporte

```bash
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║  Frontend Test — $(echo "$ENV" | tr '[:lower:]' '[:upper:]')               ║"
echo "╚════════════════════════════════════════════════════╝"
echo "  Fecha: $(date)"
echo "  URL: $BASE"
echo ""
```

## 📝 Notas

- **Producción** = solo lectura. No se crean, modifican ni eliminan datos.
- **Local** = necesita `supabase start` y `pnpm dev` corriendo.
- **Preview** = necesita rama pusheada y Vercel deployment completado.
- Los tokens JWT se guardan en `/tmp/` y se eliminan al finalizar.
- Si el login falla, probablemente el anon key no corresponde al entorno.
