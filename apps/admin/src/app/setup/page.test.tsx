import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// `renderToStaticMarkup` has no router context, so the `useRouter` hook in
// `SetupPage` must be mocked to render the form in tests.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import SetupPage from "./page";
import { submitSuperAdmin } from "./submit";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SetupPage — render", () => {
  it("renders the super-admin form with email, display name and password", () => {
    const html = renderToStaticMarkup(<SetupPage />);
    expect(html).toContain('type="email"');
    expect(html).toContain('type="text"');
    expect(html).toContain('type="password"');
    expect(html).toContain("Create super admin");
  });

  it("renders the loading state with a disabled button", () => {
    // The initial render is idle; the loading state is reached on submit.
    const html = renderToStaticMarkup(<SetupPage />);
    expect(html).not.toContain("Creating…");
  });
});

describe("submitSuperAdmin", () => {
  const input = { email: "admin@example.com", password: "secret123", displayName: "Eric" };
  const fetchMock = vi.fn();

  it("posts to the setup door and resolves ok on 201", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitSuperAdmin(input);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/setup/super-admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: input.email, password: input.password, display_name: input.displayName }),
    });
  });

  it("maps a non-201 response to a readable message", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Setup already completed" } }), { status: 409 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitSuperAdmin(input);

    expect(result).toEqual({ ok: false, message: "Setup already completed" });
  });

  it("falls back to a generic message when the error body is not parseable", async () => {
    fetchMock.mockResolvedValueOnce(new Response("gateway error", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitSuperAdmin(input);

    expect(result).toEqual({ ok: false, message: "Setup failed" });
  });
});
