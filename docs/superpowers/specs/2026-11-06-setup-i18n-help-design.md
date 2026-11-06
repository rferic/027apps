# Spec — Setup: selector de idioma y ayuda de Firebase

**Fecha:** 2026-11-06 · **Estado:** Borrador para aprobación del usuario
**Base:** [i18n operativa](2026-10-26-i18n-operativa.md) · [instance-config](2026-10-26-instance-config.md) · [admin shell](2026-10-26-admin-shell.md) · [auth](2026-10-25-auth.md) · `AGENTS.md` · `docs/flows/i18n.md`

## 1. Objetivo

Cerrar dos huecos del wizard de instalación:

1. Un **selector de idioma en todo el wizard** y en una **página pública de ayuda de Firebase**; la selección persiste y la ayuda se abre en ese mismo idioma. La ayuda también tiene su propio selector.
2. Un **botón de ayuda** en la sección de notificaciones del wizard que abre esa guía pública en otra pestaña.

Además, el idioma elegido en el wizard se **propone** como `localization.default_locale` al llegar al formulario de Preferences; el instalador puede cambiarlo antes de guardar.

## 2. Por qué

- El wizard es la primera pantalla que ve quien instala y hoy solo está en inglés, aunque los 51 textos ya están traducidos en el repo.
- Configurar Firebase es el paso con más fricción externa; una guía contextual evita salir a buscar documentación y reduce errores.
- El idioma de la interfaz y el idioma por defecto de la instancia son dos decisiones distintas: la primera guía la instalación, la segunda configura el producto. Proponer la primera como segunda ahorra un paso sin imponerla.

## 3. Alcance

**Dentro:**

- `LocaleSwitcher` visible en las cinco pantallas de `/setup` y en `/help/firebase`.
- Persistencia en cookie `027_locale`, validada contra los 9 locales.
- Diccionarios leídos de `packages/i18n/locales/*.json` (el repo es la fuente de verdad).
- Adopción de `t()` en los componentes del wizard (servidor y cliente).
- Página pública `/help/firebase`, localizada y con selector propio.
- Enlace de ayuda en `Step 5 · Notifications` con `target="_blank"` y `?lang=`.
- Propuesta de `default_locale` en Preferences.
- `<html lang>` dinámico a partir de la cookie.
- Tests, `i18n:scan`/`i18n:check` y traducción de las cadenas nuevas a los 8 locales.

**Fuera:**

- Traducir el panel privado; eso es sprint-web.
- Editor/import de traducciones y uso de la tabla `translations` en el wizard.
- Traducir las plantillas SMTP de Supabase.
- RTL, plurales/ICU y locales nuevos.
- Guardar el idioma de la interfaz como setting de instancia: solo se **propone** `default_locale` al guardar Preferences.
- Cambiar el idioma de la app Android.

## 4. Enfoque elegido

**A. Cookie + diccionarios del repo.**

- El wizard y la ayuda resuelven el idioma con `?lang` (solo ayuda) → cookie → `en`; cualquier valor no soportado cae a `en`.
- `@027apps/i18n` expone `getDictionary(locale)` con imports estáticos de los 9 JSON; `en` devuelve `{}` porque `t()` ya cae al texto inglés.
- Un componente cliente `LocaleSwitcher` escribe la cookie y refresca; en la ayuda actualiza además `?lang` para que el enlace sea compartible.
- El wizard no depende de la BD antes de instalar; el panel seguirá usando `translations` cuando llegue sprint-web. Esta dualidad se documenta.

**Por qué no B/C:** sembrar la BD antes de instalar añade una dependencia y un fallo posible en la primera pantalla (B); llevar el idioma solo en la URL pierde el valor en las server actions que redirigen a `/setup` y obliga a arrastrarlo por todos los pasos (C).

## 5. Contrato técnico

### 5.1 Resolución del idioma

- Cookie `027_locale`: `Path=/`, `SameSite=Lax`, `Max-Age=31536000`, **no HttpOnly** (no es sensible; la escribe el cliente).
- `resolveLocale({ query, cookie })`: primer valor válido de `query.lang`, `cookie`, `en`.
- `isSupportedLocale(value)` contra los 9 de `SUPPORTED_LOCALES`.
- En `/help/firebase`, `?lang` gana sobre la cookie para que un enlace compartido abra en su idioma.
- **Documentación:** el contrato de la cookie se documenta en `docs/flows/i18n.md` (atributos, precedencia, validación y distinción entre idioma de interfaz y `default_locale` de la instancia). No es una cookie de sesión: no es `HttpOnly` porque la escribe el cliente y no contiene identidad ni secretos.

### 5.2 Diccionarios e interpolación

- `packages/i18n/src/dictionary.ts`: `getDictionary(locale): TranslationMap`, con imports estáticos de `locales/<locale>.json`.
- Export `./dictionary.js` en `packages/i18n/package.json`.
- `apps/admin` añade `@027apps/i18n` a dependencias y a `transpilePackages` (exporta TS fuente, igual que `@027apps/core`).
- `t(text, map, params?)` se amplía para sustituir `{param}`. La spec de i18n ya exige paridad de placeholders; hoy `t()` no los reemplaza. La ampliación es retrocompatible y se cubre con tests.
- **Alcance de traducción:** todas las cadenas **visibles** del wizard y de la ayuda, no solo las 51 del catálogo. Eso incluye prosa larga, mensajes de formulario, el bloqueo de JWT y la guía completa; hay que añadirlas con `i18n:scan` y traducirlas a los 8 locales.
- Toda cadena traducible se escribe como `t("...")` **literal** para que `i18n:scan` la catalogue. La ayuda se compone de llamadas literales, no de un módulo de contenido opaco.
- Mensajes del API: los que ya tienen texto en el catálogo se traducen; los desconocidos se muestran con un prefijo traducido y el mensaje original como detalle (nunca se inventa una traducción de un texto que no está en el catálogo).

### 5.3 UI

- `apps/admin/src/components/locale-switcher.tsx` (cliente): `<select>` con nombres nativos (`English`, `Español`, `Català`, `Italiano`, `Français`, `Deutsch`, `Português`, `Galego`, `Euskara`), etiqueta traducida y `aria-label`.
- El wizard usa un wrapper común (`screen`) con una cabecera repetida en los cinco pasos: logo a la izquierda y selector a la derecha. El logo sale de `SetupForm` para no duplicarlo; no se añade otro indicador de progreso. Alternativa descartada: mantener el selector absoluto y el logo solo en el paso 2, porque no da una identidad consistente durante la instalación. Cambio visual aprobado por el usuario el 2026-11-06.
- Los componentes de servidor (`EnvironmentChecklist`, la página) reciben el mapa y llaman a `t(texto, messages)` directamente; los cliente (`SetupForm`, `SmtpStep`, `PreferencesStep`) reciben `messages: TranslationMap` como prop y llaman a `t(texto, messages)`.
- El enlace de ayuda vive en el fieldset de notificaciones: `href="/help/firebase?lang=<locale>"`, `target="_blank"`, `rel="noopener noreferrer"`.
- `/help/firebase`: página pública, sin sesión ni BD; contenido en pasos y enlace externo a la consola de Firebase. No incluye valores reales ni secretos.

### 5.4 Default locale en Preferences

- `preferencesStep` calcula `uiLocale` y lo pasa a `PreferencesStep`.
- Si `localization.default_locale` está vacío o es el valor semilla `en`, el formulario arranca con `uiLocale`; si ya hay un valor distinto, se respeta.
- No se sincroniza en vivo si el usuario cambia el idioma de la interfaz estando ya en Preferences: la propuesta ocurre al llegar. El campo sigue siendo editable y se guarda con el resto.

### 5.5 `<html lang>`

- **No se toca el layout raíz.** Leer `cookies()` ahí haría dinámicas todas las rutas (panel, login, setup, ayuda) y perdería el shell estático con Cache Components.
- El wizard y la ayuda montan un pequeño componente cliente que fija `document.documentElement.lang` al locale resuelto; el contenido de la ayuda lleva además `lang={locale}` en su contenedor.
- El panel conserva el `lang` actual hasta que su i18n llegue en sprint-web.

### 5.6 Proxy y ayuda pública

- `/help/*` no debe depender de Supabase: es la guía a la que se acude cuando la instalación aún no está configurada. El proxy genera la CSP y las cabeceras, pero **omite** `sessionClient`/`getUser` y el gate para esa ruta.
- El resto de rutas mantiene el comportamiento actual (refresh de sesión, gate y CSP).
- Test: la ruta de ayuda no llama a Supabase y responde 200 sin variables de Supabase.

## 6. Contenido de la ayuda

Secciones, en el idioma activo:

1. Qué es FCM y para qué lo usa 027Apps.
2. Crear el proyecto en Firebase.
3. Añadir la app Android con el paquete `com.rferic.zero27apps`.
4. Copiar los cuatro valores públicos: project id, app id, web API key y sender id.
5. Generar la service account (Project settings → Service accounts) y guardarla como secreto.
6. Comprobar que la API de FCM está habilitada.
7. Pegar los valores en el wizard y elegir `Firebase Cloud Messaging` como provider.
8. Avisos: la service account no se commitea; la web API key es pública; la app Android debe usar el mismo paquete.

Sin datos concretos de la instancia, sin service account y sin enlaces que ejecuten acciones.

## 7. Criterios de aceptación

- El selector aparece en los cinco pasos del wizard y en la ayuda; cambiar de idioma traduce **todas las cadenas visibles** de la pantalla **sin perder el paso actual**.
- El enlace de ayuda se abre en otra pestaña, en el idioma activo, y su selector cambia el idioma de la página.
- Preferences propone el idioma del wizard como `default_locale` cuando el valor guardado es el de semilla (`en`) o está vacío; el usuario puede cambiarlo.
- Un valor de cookie/query no soportado cae a `en`; no se acepta texto arbitrario.
- `t()` interpola `{param}` y conserva el fallback a inglés; los placeholders se validan en `i18n:check`.
- `i18n:scan` actualiza el catálogo y `i18n:check` pasa con los 9 locales completos.
- `/help/firebase` responde 200 sin sesión y sin variables de Supabase; el proxy mantiene la CSP.
- El layout raíz sigue estático; el `<html lang>` del wizard/ayuda se fija en cliente.
- Tests: resolución de idioma, selector, enlace de ayuda, propuesta de default, render traducido, interpolación, proxy de ayuda y página pública.
- La ayuda no expone secretos; los enlaces externos llevan `noopener noreferrer`.
- Docs actualizadas: `docs/flows/i18n.md`, `docs/flows/fcm-validation.md` y fichero de tarea.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Dos caminos de i18n (repo vs BD) | Documentar que wizard/ayuda leen el repo y el panel usará la BD en sprint-web. |
| `router.refresh()` con Cache Components no re-renderiza | El wizard ya usa `instant = false`; test de integración del selector y prueba manual. |
| Traducciones nuevas de baja calidad | Las revisa el agente Traductor y `i18n:check` valida claves/placeholders. |
| Leer la cookie en el layout raíz haría dinámicas todas las rutas | No se toca el layout raíz; el `lang` del wizard/ayuda se fija en cliente. |
| La ayuda no carga si Supabase está caído o sin configurar | El proxy omite `getUser` para `/help/*` y mantiene la CSP; test sin variables de Supabase. |
| Mensajes de error del API fuera del catálogo | Se muestran con un prefijo traducido y el original como detalle; no se traducen al vuelo. |
| El selector de UI se confunde con el idioma por defecto de la instancia | Etiquetas distintas: “Idioma del asistente” y “Idioma por defecto”; nota en Preferences. |

## 9. Testing

- Unitario: `resolveLocale` con query/cookie inválidos y precedencia.
- Unitario: `t()` interpola `{param}`, conserva el fallback y no rompe sin parámetros.
- Componente: `LocaleSwitcher` escribe la cookie y refresca; la ayuda actualiza `?lang`.
- Componente: el enlace de ayuda lleva `?lang` y `target="_blank"`.
- Página: `preferencesStep` propone `uiLocale` cuando el setting es `en`/vacío y respeta un valor distinto.
- Render: una pantalla del wizard en español contiene el texto traducido (mapa del repo).
- Proxy: `/help/firebase` no llama a Supabase y responde sin variables de entorno.
- `i18n:check` en CI.

## 10. Plan y entrega

- Aprobación de esta spec → plan de implementación (`writing-plans`).
- Rama y tarea: nueva tarea de `sprint-web` (setup/i18n) o rama `feature/setup-i18n-help` desde `main`; se decide en el plan para no mezclarla con sprint-06.
- TDD: tests primero, luego implementación, auditorías QA/estilo/seguridad y `i18n:check` antes de `finalizada`.
