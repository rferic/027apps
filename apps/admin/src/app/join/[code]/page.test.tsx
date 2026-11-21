import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { previewMock, limitMock } = vi.hoisted(() => ({
  previewMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
}));

vi.mock("@/lib/api/door", () => ({
  getInfra: async () => ({ deps: { rateLimitStorage: { increment: limitMock } } }),
}));

vi.mock("@/lib/request-locale", () => ({
  requestLocale: async () => "en",
}));

vi.mock("@/lib/join-preview", () => ({
  loadJoinPreview: previewMock,
}));

import JoinPage, { metadata } from "./page";

const PREVIEW = {
  state: "pending" as const,
  inviter_name: "Eric",
  instance_name: "Familia Pérez",
};

function render(code = "027_join_abc123") {
  return JoinPage({ params: Promise.resolve({ code }) }).then(renderToStaticMarkup);
}

beforeEach(() => {
  previewMock.mockReset();
  previewMock.mockResolvedValue(PREVIEW);
  limitMock.mockReset();
  limitMock.mockResolvedValue({ count: 1 });
});

describe("join page", () => {
  it("previews the inviter and the instance and offers Continue", async () => {
    const html = await render();

    expect(html).toContain("You have been invited to join");
    expect(html).toContain("Familia Pérez");
    expect(html).toContain("Eric");
    expect(html).toContain("Continue");
    expect(previewMock).toHaveBeenCalledWith("027_join_abc123");
  });

  it("explains a used code and offers no exchange button", async () => {
    previewMock.mockResolvedValue({ ...PREVIEW, state: "used" });

    const html = await render();

    expect(html).toContain("This invitation has already been used.");
    expect(html).not.toContain(">Continue<");
  });

  it("explains an expired code and offers no exchange button", async () => {
    previewMock.mockResolvedValue({ ...PREVIEW, state: "expired" });

    const html = await render();

    expect(html).toContain("This invitation has expired. Ask an administrator for a new one.");
    expect(html).not.toContain(">Continue<");
  });

  it("renders the generic card for an unknown code", async () => {
    previewMock.mockResolvedValue(null);

    const html = await render();

    expect(html).toContain("The link is not valid or has expired. Request a new one.");
    expect(html).not.toContain(">Continue<");
  });

  it("is not indexable and sends no referrer", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("never paints the code on the page", async () => {
    const html = await render("027_join_secretvalue123");

    expect(html).not.toContain("027_join_secretvalue123");
  });
});

describe("join page rate limit", () => {
  it("answers with a clear message once the page budget is spent", async () => {
    limitMock.mockResolvedValue({ count: 61 });

    const html = await render();

    expect(html).toContain("Too many attempts");
    // The budget is spent before touching the code.
    expect(previewMock).not.toHaveBeenCalled();
  });
});
