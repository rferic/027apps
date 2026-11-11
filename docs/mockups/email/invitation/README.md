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

Pendiente de elección del propietario. Recomendación: **v1** como plantilla base reutilizable,
con el CTA y la caja de caducidad de v3 si se quiere más énfasis en móvil.
