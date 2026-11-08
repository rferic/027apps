import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyScopeFieldset } from "./api-key-scope-fieldset";
import { allowedApiKeyScopes } from "@/lib/api-key-scopes";

const MODULES = [
  { key: "recetas", name: "Recetas" },
  { key: "fotos", name: "Fotos" },
];

function fieldset(overrides: {
  selected?: readonly string[];
  modules?: readonly { key: string; name: string }[];
  fieldErrors?: Record<string, string[]>;
} = {}) {
  return renderToStaticMarkup(
    <ApiKeyScopeFieldset
      kind="delegated"
      roleCap=""
      selected={overrides.selected ?? []}
      onToggle={vi.fn()}
      onSelectAll={vi.fn()}
      onClearAll={vi.fn()}
      modules={overrides.modules}
      fieldErrors={overrides.fieldErrors ?? {}}
      messages={{}}
    />,
  );
}

function buttonMarkup(html: string, label: string): string {
  const match = new RegExp(`<button[^>]*>${label}</button>`).exec(html);
  if (!match) throw new Error(`no button "${label}"`);
  return match[0].replace(/\sclass="[^"]*"/, "");
}

describe("ApiKeyScopeFieldset module permissions", () => {
  it("renders two checkboxes per module, read and read-and-write", () => {
    const html = fieldset({ modules: MODULES });

    expect(html).toContain("Module permissions");
    expect(html).toContain("Recetas");
    expect(html).toContain("Fotos");
    expect(html).toContain('value="recetas:read"');
    expect(html).toContain('value="recetas:read_write"');
    expect(html).toContain('value="fotos:read"');
    expect(html).toContain('value="fotos:read_write"');
    expect(html.match(/name="scopes"/g)?.length).toBe(
      allowedApiKeyScopes("delegated", "").length + 4,
    );
    expect(html).toContain("Read and write");
  });

  it("shows no module section when the owner has no modules", () => {
    const html = fieldset();

    expect(html).not.toContain("Module permissions");
    expect(html).not.toContain("recetas:read");
  });

  it("keeps select-all enabled until the module scopes are selected too", () => {
    const core = allowedApiKeyScopes("delegated", "");

    const coreOnly = fieldset({ selected: core, modules: MODULES });
    expect(buttonMarkup(coreOnly, "Select all")).not.toContain("disabled");

    const all = fieldset({
      selected: [...core, "recetas:read", "recetas:read_write", "fotos:read", "fotos:read_write"],
      modules: MODULES,
    });
    expect(buttonMarkup(all, "Select all")).toContain("disabled");
  });

  it("ties the module checkboxes to the scope error", () => {
    const html = fieldset({
      modules: MODULES,
      fieldErrors: { scopes: ["Pick one"] },
    });

    expect(html).toContain('aria-describedby="api-key-scopes-error"');
  });

  it("marks the stored module scopes as checked", () => {
    const html = fieldset({ modules: MODULES, selected: ["recetas:read_write"] });

    expect(html).toContain('checked="" value="recetas:read_write"');
    expect(html).not.toContain('checked="" value="fotos:read"');
  });
});
