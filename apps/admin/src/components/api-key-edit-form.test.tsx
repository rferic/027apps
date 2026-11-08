import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyEditForm } from "./api-key-edit-form";
import {
  buildApiKeyUpdateInput,
  mergeKeyScopes,
  splitKeyScopes,
} from "@/lib/api-key-edit";
import { allowedApiKeyScopes } from "@/lib/api-key-scopes";
import type { ApiKeyRow } from "@/lib/panel-keys";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

const KEY: ApiKeyRow = {
  id: "k1",
  kind: "delegated",
  name: "Mobile app",
  scopes: ["profile:read", "recetas:read_write"],
  user_id: "u1",
  owner: "Sara",
  roleCap: null,
  prefix: "027_usr_",
  expiresAt: null,
  revoked_at: null,
  last_used_at: null,
  created_at: "2026-11-01T10:00:00.000Z",
};

function form(apiKey: ApiKeyRow = KEY) {
  return renderToStaticMarkup(
    <ApiKeyEditForm
      apiKey={apiKey}
      action={async () => ({ error: null })}
      messages={{}}
    />,
  );
}

function buttonMarkup(html: string, label: string): string {
  const match = new RegExp(`<button[^>]*>${label}</button>`).exec(html);
  if (!match) throw new Error(`no button "${label}"`);
  return match[0].replace(/\sclass="[^"]*"/, "");
}

describe("ApiKeyEditForm module permissions", () => {
  it("shows a stored module scope as a read-only chip with its own explanation", () => {
    const html = form();

    expect(html).toContain("Module permissions");
    expect(html).toContain(
      "Module permissions depend on the modules granted to the owner and are managed from the app.",
    );
    expect(html).toContain("recetas:read_write");
    // No checkbox and no hidden field: the panel never submits it.
    expect(html).not.toContain('value="recetas:read_write"');
    // The Core scope keeps its editable checkbox.
    expect(html).toContain('checked="" value="profile:read"');
  });

  it("keeps saving available when only module permissions remain", () => {
    const html = form({ ...KEY, scopes: ["recetas:read_write"] });

    expect(buttonMarkup(html, "Save changes")).not.toContain("disabled");
    expect(html).not.toContain("Choose at least one scope.");
  });

  it("blocks the save only when no scope is left, editable or preserved", () => {
    const html = form({ ...KEY, scopes: [] });

    expect(buttonMarkup(html, "Save changes")).toContain("disabled");
    expect(html).toContain("Choose at least one scope.");
  });

  it("keeps the module scope in the patch after clearing every editable scope", () => {
    const allowed = allowedApiKeyScopes("delegated", "");
    const { editable, preserved } = splitKeyScopes(KEY.scopes, allowed);

    expect(editable).toEqual(["profile:read"]);
    expect(preserved).toEqual(["recetas:read_write"]);

    // "Clear all" only empties the editable state.
    const cleared: readonly string[] = [];
    const patch = buildApiKeyUpdateInput({
      name: KEY.name,
      scopes: mergeKeyScopes(preserved, cleared, allowed),
    });

    expect(patch?.scopes).toEqual(["recetas:read_write"]);
  });
});
