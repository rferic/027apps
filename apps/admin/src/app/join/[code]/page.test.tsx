import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { previewMock } = vi.hoisted(() => ({ previewMock: vi.fn() }));

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
