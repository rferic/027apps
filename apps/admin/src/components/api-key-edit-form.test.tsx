import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyEditForm } from "./api-key-edit-form";
import {
  buildApiKeyUpdateInput,
  mergeKeyScopes,
  splitKeyScopes,
} from "@/lib/api-key-edit";
import { apiKeyOfferedScopes } from "@/lib/api-key-module-scopes";
import type { ApiKeyRow } from "@/lib/panel-keys";

vi.mock("next/navigation", () => ({
  usePathname: () => "/keys/k1/edit",
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

function form(
  apiKey: ApiKeyRow = KEY,
  modules: readonly { key: string; name: string }[] = [],
  messages: Record<string, string> = {},
) {
  return renderToStaticMarkup(
    <ApiKeyEditForm
      apiKey={apiKey}
      modules={modules}
      action={async () => ({ error: null })}
      currentLabel={apiKey.expiresAt ? "Jan 1, 2027" : ""}
      messages={messages}
    />,
  );
}

function buttonMarkup(html: string, label: string): string {
  const match = new RegExp(`<button[^>]*>${label}</button>`).exec(html);
  if (!match) throw new Error(`no button "${label}"`);
  return match[0].replace(/\sclass="[^"]*"/, "");
}

describe("ApiKeyEditForm module permissions", () => {
  it("offers the owner's modules as editable checkboxes", () => {
    const html = form(KEY, [{ key: "recetas", name: "Recetas" }]);

    expect(html).toContain("Module permissions");
    expect(html).toContain("Recetas");
    expect(html).toContain('value="recetas:read"');
    expect(html).toContain('checked="" value="recetas:read_write"');
    expect(html).not.toContain("Not available");
  });

  it("allows removing a module permission the owner still has", () => {
    const html = form({ ...KEY, scopes: ["recetas:read_write"] }, [
      { key: "recetas", name: "Recetas" },
    ]);

    expect(html).toContain('value="recetas:read_write"');
    expect(html).not.toContain("Not available");
    expect(buttonMarkup(html, "Save changes")).not.toContain("disabled");
  });

  it("shows a module scope the owner no longer has as read-only under Not available", () => {
    const html = form();

    expect(html).toContain("Not available");
    expect(html).toContain(
      "These permissions are no longer offered, so they are kept as they are.",
    );
    expect(html).toContain("recetas:read_write");
    // No checkbox and no hidden field: the panel never submits it from the form.
    expect(html).not.toContain('value="recetas:read_write"');
    // The Core scope keeps its editable checkbox.
    expect(html).toContain('checked="" value="profile:read"');
  });

  it("never offers modules for a service key", () => {
    const html = form(
      { ...KEY, kind: "service", user_id: null, roleCap: "super_admin" },
      [{ key: "recetas", name: "Recetas" }],
    );

    expect(html).not.toContain('value="recetas:read"');
    expect(html).not.toContain('value="recetas:read_write"');
    expect(html).toContain("Not available");
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

  it("keeps an unavailable module scope in the patch after clearing every editable scope", () => {
    const offered = apiKeyOfferedScopes("delegated", "", []);
    const { editable, preserved } = splitKeyScopes(KEY.scopes, offered);

    expect(editable).toEqual(["profile:read"]);
    expect(preserved).toEqual(["recetas:read_write"]);

    // "Clear all" only empties the editable state.
    const cleared: readonly string[] = [];
    const patch = buildApiKeyUpdateInput({
      name: KEY.name,
      scopes: mergeKeyScopes(preserved, cleared, offered),
    });

    expect(patch?.scopes).toEqual(["recetas:read_write"]);
  });
});

describe("ApiKeyEditForm expiry", () => {
  it("starts on never and hides keep when the key has no expiry", () => {
    const html = form();

    expect(html).toContain('checked="" value="never"');
    expect(html).not.toContain('value="keep"');
    expect(html).toContain("A key without an expiry never stops working.");
  });

  it("starts on keep and shows the formatted current expiry", () => {
    const html = form({ ...KEY, expiresAt: "2027-01-01T00:00:00.000Z" });

    expect(html).toContain('checked="" value="keep"');
    expect(html).toContain("Currently expires on Jan 1, 2027");
    expect(html).toContain('value="never"');
    expect(html).toContain('value="relative"');
  });

  it("replaces the datetime-local input with the relative field", () => {
    const html = form({ ...KEY, expiresAt: "2027-01-01T00:00:00.000Z" });

    expect(html).not.toContain('type="datetime-local"');
    expect(html).not.toContain('name="current_expires_at"');
    expect(html).toContain('name="expiry_mode"');
    expect(html).toContain('name="expiry_amount"');
    expect(html).toContain('name="expiry_unit"');
  });
});
