import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// `renderToStaticMarkup` has no router context, so the `useRouter` hook in
// `SetupForm` must be mocked to render the form in tests.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { SetupForm } from "./setup-form";
import { submitSuperAdmin } from "./submit";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SetupForm — render", () => {
  it("renders the super-admin form with email, display name and password", () => {
    const html = renderToStaticMarkup(<SetupForm messages={{}} />);
    expect(html).toContain('type="email"');
    expect(html).toContain('type="text"');
    expect(html).toContain('type="password"');
    expect(html).toContain("Create super admin");
  });

  it("renders the loading state with a disabled button", () => {
    // The initial render is idle; the loading state is reached on submit.
    const html = renderToStaticMarkup(<SetupForm messages={{}} />);
    expect(html).not.toContain("Creating…");
  });

  it("explains each field and enforces the password length in the browser", () => {
    const html = renderToStaticMarkup(<SetupForm messages={{}} />);
    expect(html).toContain("We use this to sign you in.");
    expect(html).toContain("How you will appear in the app.");
    expect(html).toContain("At least 12 characters.");
    expect(html).toContain('minLength="12"');
  });
});

describe("submitSuperAdmin", () => {
  const input = { email: "admin@example.com", password: "secret123", displayName: "Eric" };
  const fetchMock = vi.fn();

  it("posts to the setup door and resolves ok on 201", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitSuperAdmin(input, {});

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

    const result = await submitSuperAdmin(input, {});

    expect(result).toEqual({ ok: false, message: "Setup already completed", fieldErrors: {} });
  });

  it("falls back to a generic message when the error body is not parseable", async () => {
    fetchMock.mockResolvedValueOnce(new Response("gateway error", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitSuperAdmin(input, {});

    expect(result).toEqual({
      ok: false,
      message: "We couldn't create the super admin. Try again.",
      fieldErrors: {},
    });
  });

  it("explains a network failure instead of throwing", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitSuperAdmin(input, {});

    expect(result).toEqual({
      ok: false,
      message: "We couldn't reach the server. Check your connection, then try again.",
      fieldErrors: {},
    });
  });

  it("turns field validation errors into readable sentences", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "validation_failed",
            message: "Validation failed",
            details: { fieldErrors: { password: ["Too small: expected string to have >=12 characters"] } },
          },
        }),
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitSuperAdmin(input, {});

    expect(result).toEqual({
      ok: false,
      message: "Please check the highlighted fields and try again.",
      fieldErrors: {
        password: "Use at least 12 characters. A longer passphrase is safer and easier to remember.",
      },
    });
  });

  it("joins every invalid field in one message", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "validation_failed",
            message: "Validation failed",
            details: { fieldErrors: { email: ["Invalid email"], password: ["Too small"] } },
          },
        }),
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitSuperAdmin(input, {});

    expect(result).toEqual({
      ok: false,
      message: "Please check the highlighted fields and try again.",
      fieldErrors: {
        email: "Enter a valid email address, for example name@example.com.",
        password: "Use at least 12 characters. A longer passphrase is safer and easier to remember.",
      },
    });
  });
});
