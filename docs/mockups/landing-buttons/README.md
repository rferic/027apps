# Mockup — botones de descarga de la landing (tarea 08)

Mockup de las opciones de **icono de Android** y **literal** para los botones de descarga de la
web pública. No es una imagen: es un HTML navegable con las tres colocaciones reales (hero,
sección Android y cierre), claro/oscuro y los 9 idiomas en la implementación.

```bash
open docs/mockups/landing-buttons/index.html
```

## Controles

Fuera de la landing, a propósito: no son UI del producto.

- **Idioma**: español / inglés.
- **Literal**: seis opciones, aplicadas a los dos botones principales a la vez.
- **Icono**: con el robot monocromo o sin él (el estado actual).
- **Tema**: claro / oscuro.

También por URL:

```text
?variant=1                  # Descargar para Android (recomendada)
?variant=3&lang=en          # Install on Android, en inglés
?variant=1&theme=dark       # en oscuro
?variant=0&icon=off         # el estado actual, sin icono
```

## Qué se decide

1. El **literal** del botón principal (tabla de la página, con ventajas e inconvenientes).
2. Si el icono de Android entra en los **tres** botones de descarga (hero, sección 08 y cierre).

El botón secundario («Ver en GitHub» / «Código en GitHub») no cambia. El enlace sigue apuntando a
GitHub Releases, sin Google Play ni QR.
