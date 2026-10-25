# Marca 027Apps

> Guía consolidada de marca. Base: identidad D (`identities/d.md`, ADR 0002) y logo L4 «Latido» (ADR 0003). Los valores de color viven en `identities/d.md`; aquí solo se documenta uso.

## Historia de la marca

El logotipo hereda la idea del proyecto anterior (`~/Sites/027apps`): un **latido** — línea de electrocardiograma blanca sobre cuadrado rojo `#9B1C1C`, con «027» pequeño dentro del icono, wordmark «027» + «Apps» en color de marca y la tagline **«YOUR APPS. YOUR GROUP.»** (componente `HeartbeatLogo` del legacy). La idea no cambió: la plataforma es el pulso de la familia y sus apps. Cambia la piel: los monitores ECG reales trazan en **verde**, así que el latido viste el teal de la identidad D (`#1CC29F`) sobre el squircle zinc oscuro, con Inter 800 en el wordmark y JetBrains Mono en el «027» y la tagline.

## Elementos y versiones

| Fichero (`docs/brand/assets/`) | Elemento | Uso |
|---|---|---|
| `wordmark-light.svg` / `wordmark-dark.svg` | Wordmark completo con tagline | Landing, README, presentaciones |
| `wordmark-bare-light.svg` / `wordmark-bare-dark.svg` | Wordmark sin tagline | Headers del admin y de la app móvil |
| `wordmark-mono.svg` | Wordmark en una tinta (`currentColor`) | Sellos, marcas de agua, superficies de color: se tiñe con CSS `color` |
| `icon-dark.svg` / `icon-light.svg` | Icono completo: squircle + electro + «027» | Icono de app, favicon, avatar |
| `mark.svg` | Solo el electro (`currentColor` stroke) | Tamaños pequeños, decoración, estados de carga |
| `playstore-512.png` | Icono 512 px | Ficha de Play Console / enlace de descarga |
| `ic_launcher_foreground.xml` | Capa foreground del adaptive icon | `apps/android` (copia en `res/drawable/`) |

En el admin los iconos viven en `apps/admin/src/app/` (`icon.svg`, `icon.png`, `apple-icon.png`, `favicon.ico`) y Next los sirve automáticamente. En Android: `res/mipmap-*` + `mipmap-anydpi-v26/ic_launcher.xml` (adaptive: fondo `#0E0F11` + foreground vectorial) y splash con `windowSplashScreenBackground` (`#FFFFFF` claro / `#08090A` oscuro).

## Área de respeto y tamaños mínimos

- **Área de respeto** del icono: la mitad del grosor del trazo del electro (~3/48 del lado del squircle) por cada lado. Nada entra ahí.
- **Wordmark**: mínimo 120 px de ancho para que la tagline sea legible; por debajo, usa la variante *bare*.
- **Icono**: completo a partir de 32 px; entre 16 y 24 px usa la variante simplificada (solo electro, `mark.svg`); el favicon 16 px del admin lleva el icono completo porque el «027» desaparece visualmente pero la silueta del latido se mantiene.
- El electro nunca baja de 2,6 unidades de grosor en el sistema de 48: por debajo, la silueta se rompe.

## No hacer

- No recolorear el electro fuera de `#1CC29F` (oscuro), `#09795F` (claro) o monocromo. El rojo `#9B1C1C` es historia, no marca.
- No rotar, estirar ni inclinar el latido; no añadir sombras, degradados ni contornos.
- No partir «027» de «Apps» en el wordmark, ni cambiar la tagline de tipografía o interletrado.
- No poner el wordmark claro sobre fondos claros ni el oscuro sobre oscuros: usa la variante correspondiente o la mono.
- No reconstruir los SVG a mano: se regeneran con el pipeline (abajo).

## Pipeline de assets

```bash
# 1. Masters SVG (texto -> paths; requiere venv con fonttools, brotli, uharfbuzz
#    y los TTF variables de github.com/google/fonts: Inter[opsz,wght], JetBrainsMono[wght])
python scripts/brand/build-assets.py \
  --inter /ruta/Inter-var.ttf --jbmono /ruta/JBMono-var.ttf

# 2. Renders PNG/ICO (requiere ImageMagick)
./scripts/brand/render.sh
```

Los masters no contienen `<text>` ni referencias a fuentes: son deterministas y consumibles como favicon, VectorDrawable o PNG en cualquier renderer. Cambios de paleta o geometría del latido se hacen en `scripts/brand/build-assets.py` (constantes de color y `PULSE`), nunca editando los SVG a mano.
