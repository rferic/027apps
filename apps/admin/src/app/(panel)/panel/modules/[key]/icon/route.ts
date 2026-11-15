import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { requirePanel } from "@/lib/panel-guard";
import { loadModuleManifest } from "@/lib/module-manifests";
import { modulesRoot } from "@/lib/modules";

const ICON = /^assets\/[A-Za-z0-9._/-]+\.svg$/;

/**
 * The module's monochrome icon, for the panel only.
 *
 * It is a panel route, not a Core API endpoint, because it authenticates with
 * the session cookie: an `<img>`/CSS mask cannot send a Bearer header. The path
 * is resolved inside the package root and rejected on traversal; the SVG is
 * served as an image, never inlined, so a module cannot run script in the panel.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const gate = await requirePanel("admin");
  if ("denied" in gate) return new Response(null, { status: 403 });

  const { key } = await params;
  const manifest = await loadModuleManifest(key);
  const icon = manifest?.branding.icon;
  if (!manifest || !icon || !ICON.test(icon) || icon.includes("..")) {
    return new Response(null, { status: 404 });
  }

  const root = resolve(modulesRoot(), key);
  const file = resolve(root, icon);
  if (!file.startsWith(`${root}/`)) return new Response(null, { status: 404 });

  try {
    const svg = await readFile(file, "utf8");
    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "private, max-age=60",
        // The icon is rendered as an image, but lock it down anyway.
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
