# Spec: apariencia por usuario (tema e idioma)

- **Fecha:** 2026-11-11
- **Estado:** aprobada por el usuario el 2026-11-11
- **Ámbito:** persistir tema e idioma en el perfil, con la cookie como pista rápida
- **Relacionado:** [ADR 0002](../../adr/0002-identidad-visual.md) ·
  [ADR 0008](../../adr/0008-fechas-y-moneda.md) ·
  [`docs/tasks/sprint-14-mejoras/task-05.md`](../../tasks/sprint-14-mejoras/task-05.md)

## 1. Objetivo

Que cada cuenta recupere su **tema** (sistema/claro/oscuro) y su **idioma** al volver a entrar,
aunque el navegador conserve la cookie de otra cuenta.

Hoy el selector de idioma **solo escribe la cookie** (`profiles.locale` existe pero no se
actualiza) y el tema se guarda únicamente en `027_theme`. En el mismo navegador, cambiar de
usuario arrastra la apariencia del anterior.

## 2. Decisión

- **La base de datos es la fuente de verdad.** `profiles` gana `theme` (el idioma ya está) y el
  panel lee ambos del perfil en cada render.
- **La cookie es una pista de carga rápida**, no la verdad: el script previo al pintado aplica
  el valor de la cookie para evitar el flash; en cuanto el panel conoce el perfil, **el valor de
  la base manda** y se sincroniza la cookie para las páginas públicas.
- Al cambiar de usuario en el mismo navegador, el script del panel aplica el tema/idioma del
  nuevo perfil antes de pintar el contenido.

## 3. Diseño

### 3.1 Datos (migración `0021_profile_theme.sql`)

- `profiles.theme text not null default 'system' check (theme in ('system','light','dark'))`.
- `grant update (theme) on public.profiles to authenticated` (se suma a
  `display_name, locale, timezone`).
- El test de privilegios pasa a esperar cuatro columnas.

### 3.2 API

- `PATCH /api/v1/users/{id}` acepta `theme` además de `locale`/`timezone`.
- Un usuario puede actualizar su propio perfil; nadie cambia su propio rol (ya vigente).

### 3.3 Panel

- `loadPanelUser` selecciona `display_name, role, locale, theme` y los expone en `PanelUser`.
- El layout usa `user.locale` (no la cookie) para los textos y `user.theme` para el control.
- Un script en el layout del panel, antes del contenido, aplica el tema del perfil, fija
  `lang` y **sincroniza las cookies** `027_theme`/`027_locale`.
- `ThemeSwitcher` y `LocaleSwitcher`:
  1. aplican el cambio al instante (clase y cookie),
  2. hacen `PATCH` del perfil,
  3. si el `PATCH` falla, revierten al valor anterior;
  4. el idioma además refresca la ruta para re-renderizar con el nuevo locale.

### 3.4 Orden de precedencia

1. Perfil (base de datos) al renderizar el panel.
2. Cookie solo como valor inicial del script previo al pintado y para páginas públicas
   (login, invitación, ayuda) donde aún no hay perfil.

## 4. Criterios de aceptación

1. Con dos cuentas en el mismo navegador, cada una conserva su tema e idioma al alternar.
2. Cambiar el tema o el idioma en el panel persiste tras cerrar sesión y volver.
3. No hay flash de tema al cargar el panel de una cuenta con tema distinto al de la cookie.
4. `PATCH` sin permiso o con un valor inválido devuelve el error documentado y la UI revierte.
5. `pnpm lint`, `pnpm tsc`, `pnpm test`, `pnpm --filter admin build` en verde; `db-tests` de
   privilegios actualizado; CI del PR en verde.

## 5. Fuera de alcance

- Tema por instancia o por categoría.
- Preferencias de formato distintas de tema e idioma.
- Sincronizar entre dispositivos en tiempo real (se resuelve al recargar).
