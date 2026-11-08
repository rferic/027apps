import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ current: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.current),
}));

vi.mock("../actions", () => ({
  signInAction: async () => {},
}));

import { LoginForm } from "./login-form";

beforeEach(() => {
  search.current = "";
});

describe("LoginForm", () => {
  it("shows the invitation notice after a redemption", () => {
    search.current = "notice=invitation-redeemed";

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain(
      "Invitation accepted. Sign in with your email and password. If you already had an account, use your existing password.",
    );
    expect(html).toContain('type="email"');
    expect(html).toContain("Sign in");
  });

  it("does not show the notice without the parameter", () => {
    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).not.toContain("Invitation accepted.");
  });

  it("keeps the invalid credentials error working", () => {
    search.current = "error=invalid_credentials";

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain("Wrong email or password");
    expect(html).not.toContain("Invitation accepted.");
  });

  it("can show the notice and an error at the same time", () => {
    search.current = "notice=invitation-redeemed&error=invalid_credentials";

    const html = renderToStaticMarkup(<LoginForm />);

    expect(html).toContain("Invitation accepted.");
    expect(html).toContain("Wrong email or password");
  });
});
