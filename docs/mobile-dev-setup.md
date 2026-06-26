# Mobile dev setup

## Requisitos

- macOS con Xcode (ya lo tienes)
- Node.js 22 (ya instalado)
- pnpm (ya instalado)
- Supabase local corriendo

## Arrancar por primera vez

```bash
# 1. Supabase local
supabase start

# 2. Mobile
cd mobile
npx expo start
```

Luego presiona `i` para abrir en el simulador de iOS.

## Si falla algo

| Problema | Solución |
|---|---|
| `npx expo start` no abre el simulador | Asegúrate de que Xcode esté abierto al menos una vez |
| Error de módulo no encontrado | `pnpm install` desde la raíz del proyecto |
| Pantalla en blanco en el simulador | Cierra el simulador, presiona `i` de nuevo |
| Error de conexión a Supabase | `supabase start` en otra terminal |

## Para probar todo (incluyendo auth real)

1. Crea un usuario en la web local: `http://localhost:3000`
2. En el simulador, durante el onboarding, elige "Usar 027apps.com" o introduce la URL de Supabase local
3. Haz login con el mismo email/contraseña

## Para rebuildear si tocas módulos nativos

```bash
cd mobile && npx expo prebuild
```

## Docs relacionadas

- `mobile/BUILD.md` — estructura del proyecto y comandos
- `docs/mobile-permissions-and-notifications.md` — permisos y push
