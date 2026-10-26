---
id: sprint-core-design-task-09
titulo: i18n operativa — pipeline de claves, check de CI, flujo de traducción (definición)
area: core
estado: pendiente
plan: docs/superpowers/plans/2026-10-26-sprint-core-design.md
---

Tarea 9 del sprint 04 (Diseño del Core). Sprint de **definición**: entrega una spec aprobada, sin código.

**Entregable**: spec `docs/superpowers/specs/2026-10-26-i18n-operativa.md` + el destino operativo que fije (habitualmente script + flujo + skill).

**Alcance** (la «pipeline i18n operativa» de spec §11 y la infra i18n de ADR 0008/estrategia de testing):
- **Modelo**: sobre la tabla **`translations`** de la task-01 (texto en inglés como clave, `text_hash`, fallback `locale → en`).
- **Set de locales**: el set **commiteado en el repo** de 9 idiomas activables (`en, es, ca, it, fr, de, pt, gl, eu`), `en` inamovible (ADR 0008); los no activos en una instancia no se sirven.
- **Pipeline de claves**: la fuente seed (`source: code`) alimenta `translations`; **script de sync** entre locales, y **check de CI determinista que falla** si los locales no tienen exactamente las mismas claves (ADR 0008 nivel 1, testing §6) — sin depender de `settings` en runtime.
- **Flujo de traducción con agente**: el flujo i18n (spec §11, `docs/flows/agents.md` TODO) — generación de claves, traducción con el agente Traductor, revisión; la **skill `i18n-sync`** de proyecto (spec §9/§11).
- **Gestión de traducciones** (decisión J de la task-01): importación (por `text_hash`), detección de faltantes y % traducido por locale, disponibles para el panel (sprint-web).
- **i18n de errores**: mapeo `error.<code>` por locale (ADR 0007 §8) y su test.

**Decisiones a fijar**: rutas y formato de los ficheros de claves, contenido/uso del script de sync, job de CI concreto (dónde corre, qué falla), flujo del Traductor (quién genera, quién revisa), contrato de la skill `i18n-sync`.

**Criterios de aceptación**: el check de CI es determinista y falla si falta una clave en cualquier locale activo; crear un módulo con claves nuevas no exige pasos manuales de sync; el flujo de traducción queda escrito y coherente con `agents.md`; los errores mapean `code → texto` por locale (ADR 0007).

**Referencias**: ADR 0008, `docs/conventions/testing-strategy.md` §6, `docs/flows/agents.md` (Traductor), `docs/flows/new-module.md` (claves i18n TODO), spec diseño §2/§4/§11 (i18n, skills), ADR 0007 §8.