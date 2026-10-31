# Estado de creación del módulo `<key>`

> Plantilla de `new-module`. Copia este fichero al directorio de trabajo de la tarea y
> actualízalo en cada fase. Es la memoria del proceso: si una sesión se interrumpe, el
> siguiente agente debe poder continuar desde aquí. No sustituye a la spec ni al plan.

**Módulo:** `<key>` — `<name>`
**Fecha de inicio:** `<YYYY-MM-DD>`
**Última actualización:** `<YYYY-MM-DD>`
**Estado:** `<intake|analisis|requisitos-cerrados|spec|plan|implementacion|test|finalizada>`
**Siguiente paso:** `<qué toca ahora>`

## 1. Brief

- **Idea:** `<resumen en una frase>`
- **Necesidad:** `<qué problema resuelve>`
- **Funcionalidades:** `<lista breve>`
- **Concepto general:** `<cómo se usa>`

## 2. Ejemplos y referencias

- `<app o referencia>` — `<qué se reutiliza y qué no>`

## 3. Identidad y manifest

- **Nombre:** `<name>`
- **Key:** `<key>`
- **Icono/logo:** `<ruta o decisión>`
- **Branding:** `<description>`, `<color de los 8 slots>`
- **Manifest borrador:** `<ruta o estado>`
- **Validación contra el esquema:** `<pendiente|válida|falla>`

## 4. Análisis y enriquecimiento

- **Propuesta enriquecida:** `<resumen>`
- **Mejoras sugeridas:** `<lista>`
- **Encaje con el proyecto y el Core:** `<entidades, permisos, realtime, API, MCP>`
- **Riesgos detectados:** `<lista>`
- **Contradicciones o puntos mal definidos:** `<lista>`

## 5. Requisitos cerrados

- **Límites de v1:** `<lista>`
- **No-objetivos:** `<lista>`
- **Tablas y datos:** `<lista>`
- **Pantallas/UI y páginas de admin:** `<lista>`
- **Scopes y tools MCP:** `<lista>`
- **Settings y secretos:** `<lista>`
- **Eventos y canales:** `<lista>`
- **Locales:** `<lista>`
- **Moneda/fechas:** `<decisión o N/A>`
- **`is_public`:** `<true|false>`

## 6. Dependencias del Core

| Dependencia | Estado real | Efecto si falta |
|---|---|---|
| Esquema zod + registry | `<implementada|pendiente>` | validación mecánica bloqueante |
| Suite RLS | `<implementada|pendiente>` | tests de aislamiento bloqueantes |
| Componentes del DS | `<implementada|pendiente>` | UI bloqueada |
| Pipeline i18n | `<implementada|pendiente>` | verificación bloqueante |
| Instalador en runtime | `<implementada|pendiente>` | install/activate/uninstall bloqueados |
| API `/api/v1` del Core | `<implementada|pendiente>` | endpoints dependientes bloqueados |
| Shell del admin | `<implementada|pendiente>` | `admin_pages` bloqueadas |

## 7. Artefactos

- **Spec:** `docs/superpowers/specs/<fecha>-<key>.md` — `<pendiente|borrador|aprobada>`
- **Mockup:** `docs/mockups/<key>/index.html` — `<pendiente|borrador|aceptado>`
- **Plan:** `docs/superpowers/plans/<fecha>-<key>.md` — `<pendiente|borrador|aprobado>`
- **Paquete:** `packages/<key>/` — `<pendiente|scaffold|implementado>`

## 8. Puertas

- [ ] Requisitos cerrados por el usuario.
- [ ] ¿Empezamos el spec? — respuesta explícita.
- [ ] Spec + mockup aceptados por el usuario.
- [ ] Plan aprobado por el usuario.
- [ ] UI aceptada (si aplica).
- [ ] Aceptación del resultado y orden de merge.

## 9. Dudas abiertas

- `<duda>` — `<quién decide y para cuándo>`

## 10. Bitácora

- `<YYYY-MM-DD>` — `<qué se hizo, qué se decidió y qué queda>`
