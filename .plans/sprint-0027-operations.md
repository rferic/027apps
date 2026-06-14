# Sprint 27: Operaciones y mantenimiento

**Rama:** `sprint/27-operations`
**Tareas:** TASK-222 a TASK-224 (continúa desde Sprint 26, última TASK-221)

---

## TASK-222: Configurar keep-warm con cron-job.org

Configurar un cron externo gratuito para mantener la función serverless de Vercel caliente, eliminando el cold start en producción.

**Qué hacer:**
1. Crear cuenta en [cron-job.org](https://cron-job.org) (gratis, sin tarjeta)
2. Crear endpoint ligero `GET /api/health` (sin auth, sin DB, solo texto plano)
3. Crear un cron job que haga GET a `https://027apps-eric-rf.vercel.app/api/health` cada 5 minutos
3. Verificar que funciona (el endpoint responde 200 y mantiene la función caliente)
4. Documentar la configuración en AGENTS.md o en un archivo de operaciones

**Criterios de aceptación:**
- El cron está activo y haciendo pings cada 5 minutos
- Después de 10 minutos sin tráfico real, la web responde en <200ms (no cold start)
- No consume recursos de GitHub Actions ni de Vercel
- Se puede desactivar fácilmente si es necesario

**Estimación:** S (1h)

---

## TASK-223: Verificar funcionamiento en producción post-keep-warm

Ejecutar `@opencode test-frontend production` después de 1h de keep-warm activo para verificar que los tiempos de handler han bajado significativamente.

**Criterios de aceptación:**
- `/api/v1` responde en <10ms (handler)
- `/api/v1/me` responde en <200ms (handler) 
- Las apps (Todo, Inspiration) cargan sin errores
- Comparativa con baseline del sprint 26 documentada

**Estimación:** XS (30min)

---

## TASK-224: Documentar operaciones

Crear o actualizar `docs/operations.md` (o similar) con:
- Cómo está configurado el keep-warm
- URLs de los entornos (local, preview, producción)
- Cómo ejecutar tests frontend
- Dónde están las credenciales (referencia a `~/.config/opencode/`)

**Estimación:** XS (30min)

---

## Tests

**TASK-N/A:** Al ser un sprint de operaciones, la verificación frontend se hace en TASK-223.

**Criterios de aceptación del sprint:**
- Keep-warm funcionando: ✅
- Test frontend producción: ✅
- Documentación actualizada: ✅
