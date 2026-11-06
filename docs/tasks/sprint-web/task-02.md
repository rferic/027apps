---
id: sprint-web-task-02
titulo: Setup i18n y ayuda pública de Firebase
area: web
estado: en curso
plan: docs/superpowers/plans/2026-11-06-setup-i18n-help.md
spec: docs/superpowers/specs/2026-11-06-setup-i18n-help-design.md
---

**Alcance**: selector de idioma persistido (`027_locale`) en los cinco pasos del wizard y en `/help/firebase`; diccionarios leídos del repo; `t()` con interpolación `{param}`; página pública de ayuda de Firebase abierta desde `Step 5 · Notifications`; propuesta de `default_locale` en Preferences; proxy sin Supabase para `/help/*`; traducciones de las cadenas nuevas a los 8 locales.

**TDD**: resolución de locale y cookie; selector; pasos del wizard traducidos; propuesta de default locale; enlace de ayuda; página pública sin Supabase; interpolación; `i18n:check`.

**DoD**: TDD, `lint`, `tsc`, tests, `i18n:check`, build del admin, auditorías QA/OWASP y estilo, y docs actualizadas (`docs/flows/i18n.md`, `docs/flows/fcm-validation.md` cuando exista en la rama).
