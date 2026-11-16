---
id: sprint-16-task-02
titulo: Mockups de invitación, wizard, QR y recuperación
area: diseño
estado: test
plan: docs/superpowers/plans/2026-11-16-invitation-session-migration.md
fuente: docs/superpowers/specs/2026-11-16-invitation-session-migration-design.md
mockup: docs/mockups/invitation-flow/index.html
adrs: [0002]
---

**Tarea**: producir y hacer aprobar los mockups de las pantallas nuevas **antes** de escribir UI:
aceptación en la app, wizard web, migración por QR y recuperación de contraseña.

**Entregado 2026-11-16** en `docs/mockups/invitation-flow/`; pendiente de la aprobación del
propietario (P2).

**Punto de partida**: el shell de la app (mockup A, sprint 15) y el panel ya tienen tokens,
tipografía y patrones. No hay mockup de este flujo; el propietario debe poder recorrerlo en
HTML+JS, no mirar una imagen.

**Alcance**
- Dentro:
  - `docs/mockups/invitation-flow/index.html`: app (390 px) y web (390/1440 px), claro y oscuro.
  - App: invitación cargando; cuenta nueva con email, nombre, instancia, invitador, caducidad y
    rol como **ficha** (no inputs deshabilitados) + contraseña y confirmación; cuenta existente
    solo con contraseña actual y «¿Olvidaste tu contraseña?»; caducada, usada, inválida; error de
    red con reintento y sesión conservada; canje ok; login fallido tras el canje; sesión revocada;
    pantalla de servidor no disponible (web).
  - Web: paso 1 aviso Android 8+; paso 2 descarga; paso 3 reintento con fallback; paso 4
    formulario; variantes Android/iPhone/escritorio con QR; estados caducada/usada/inválida.
  - QR: entrada en **Ajustes** del viejo y en el **login** del nuevo (visible sin sesión), QR sobre
    tarjeta blanca + cuenta atrás + autoregeneración + FLAG_SECURE + email/instancia, escáner,
    instancia, «cierra sesión primero» y éxito.
  - Reset: login con «¿Olvidaste tu contraseña?», solicitud, email (9 idiomas), confirmación con
    botón «Continuar» (no se consume al cargar), nueva contraseña, éxito y aviso.
  - `README.md` con pantallas, estados, copy, tokens, contraste AA y decisiones.
  - PNG a 390 px y 1440 px, claro y oscuro.
- Fuera: código de producto; cambiar la navegación del shell; un logo configurable.

**Dependencias**: tarea 01 aprobada (P1).

**Riesgos**: que el mockup no cubra los estados de error y el propietario los descubra en la app;
que el QR se diseñe con un escáner de terceros y no con el propio; que el aviso de Android 8+ se
pierda en la traducción.

**Criterios de aceptación**
- El propietario recorre el HTML y aprueba por escrito (P2).
- Todos los estados de la spec §8.1 están representados, en claro y oscuro, con contraste AA.
- Tokens de `apps/admin/tokens.json`; nada de hex libres.
- El copy en español es el de la spec; se marcan las claves i18n que se traducirán.
- La UI implementada corresponde con el mockup aprobado; una desviación se explica en la revisión.

**Puertas de usuario**
- Aprobar los mockups (P2). Sin esta aprobación no empieza la UI de 06, 07, 08 y 10.

**Auditoría de seguridad**: no aplica código; el mockup debe mostrar `FLAG_SECURE`, el aviso de
Android 8+ y la ausencia de tokens en pantalla.
