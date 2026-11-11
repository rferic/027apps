# Mockups — correo de invitación

Tres direcciones de diseño para el correo que recibe la persona invitada. Son **propuestas de
diseño**, no el HTML de producción: sirven para elegir dirección antes de implementar
(`docs/superpowers/specs/2026-11-10-invitation-email-design.md`, fase de diseño).

## Cómo revisarlos

Abre cada `vN.html` en el navegador (doble clic) o mira las capturas `vN.png` y `vN-dark.png`.

La barra superior es **solo de la vista previa** (idioma y tema); no forma parte del correo. El
asunto real aparece a la derecha de la barra.

- `v1.html` — **tarjeta clásica**: tarjeta centrada, logo, CTA grande, caducidad en una caja y
  aviso de seguridad. Es la base más segura y reutilizable para futuros correos.
- `v2.html` — **editorial**: sin tarjeta, alineado a la izquierda, jerarquía tipográfica, firma
  de quien invita. Se siente más personal.
- `v3.html` — **acción primero**: banda de marca, CTA a ancho completo y detalles en filas.
  Pensada para móvil y para que la acción no se pierda.

Cada mockup incluye los 9 idiomas (selector ES/CA/GL/EU/PT/FR/IT/DE/EN) y tema claro/oscuro. La
fecha se formatea con `Intl.DateTimeFormat` por locale, como exige el ADR 0008.

## Logo del encabezado

`logo-options.html` compara las variantes sobre superficie clara y oscura:

- **Actual** — wordmark con tagline. A 22 px mide ~90 px de ancho, por debajo del mínimo de
  120 px que la guía de marca pide para que la tagline se lea.
- **A** — latido + wordmark sin tagline (lockup horizontal). Legible y reutiliza los assets.
- **B** — icono de app (squircle + «027») + wordmark. Más peso y algo redundante.
- **C** — solo wordmark sin tagline.

Recomendación: **A** para el encabezado del correo; **C** si se quiere lo más discreto.

## Qué es común a las tres

- Logo de la instancia, saludo con el nombre, quién invita, CTA «Aceptar invitación», enlace de
  respaldo, caducidad explícita y aviso de seguridad.
- 600 px, una columna, sin imágenes externas ni píxeles de seguimiento.
- Datos de ejemplo ficticios (María, Eric, `027Apps`).

## Notas para la implementación

- El correo real **no** lleva JS ni barra de vista previa: el idioma se elige al crear la
  invitación y se fija en la plantilla.
- El logo irá como **PNG** absoluto (`{public_url}/…`), no SVG: Outlook no pinta SVG inline en
  correo. En estos mockups se usa el SVG del repo solo para fidelidad visual.
- El CSS se inlinea en la plantilla; `mockup.css` existe únicamente para esta revisión.
- Cuando el propietario apruebe una dirección, los mockups quedan como referencia histórica y
  la elegida pasa a `packages/core/src/email/` (layout + plantilla).

## Estado

**Elegido por el propietario (2026-11-11): plantilla `v1` con el logo A** (latido + wordmark sin
tagline). Aplicado a las tres plantillas para que la comparación siga siendo coherente.

- `v1` y `v2` usan `wordmark-bare-light/dark` junto al latido.
- `v3`, sobre banda de color, usa el wordmark **mono** tintado con la tinta de la banda, como
  pide la guía de marca para superficies de color.
- El correo real exportará el lockup a **PNG** claro y oscuro; el SVG solo se usa en el mockup.
