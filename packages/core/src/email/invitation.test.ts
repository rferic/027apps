import { describe, expect, it } from "vitest";
import { buildInvitationEmail, escapeHtml, invitationUrl } from "./invitation";
import type { InvitationEmailInput } from "./types";

const base: InvitationEmailInput = {
  locale: "es",
  inviteeName: "María",
  inviterName: "Eric",
  instanceName: "027Apps",
  publicUrl: "https://027apps.ericrf.com",
  timeZone: "Europe/Madrid",
  token: "027_inv_abc123",
  expiresAt: new Date("2026-11-18T12:00:00Z"),
};

describe("invitation email", () => {
  it("renders the approved copy with the invitation link", () => {
    const email = buildInvitationEmail(base);

    expect(email.subject).toBe("Eric te ha invitado a 027Apps");
    expect(email.html).toContain("Hola, María");
    expect(email.html).toContain("Eric te ha invitado a unirte a 027Apps");
    expect(email.html).toContain("Aceptar invitación");
    expect(email.html).toContain("https://027apps.ericrf.com/invite/027_inv_abc123");
    expect(email.html).toContain("miércoles, 18 de noviembre de 2026");
    expect(email.text).toContain("https://027apps.ericrf.com/invite/027_inv_abc123");
    expect(email.text).toContain("Este enlace caduca el miércoles, 18 de noviembre de 2026");
  });

  it("localizes the date with the email locale", () => {
    const english = buildInvitationEmail({ ...base, locale: "en" });

    expect(english.subject).toBe("Eric invited you to 027Apps");
    expect(english.html).toContain("Wednesday, November 18, 2026");
  });

  it("uses the instance public URL without a double slash", () => {
    const email = buildInvitationEmail({ ...base, publicUrl: "https://panel.example.com/" });

    expect(email.html).toContain("https://panel.example.com/invite/027_inv_abc123");
    expect(email.html).not.toContain("example.com//invite");
  });

  it("escapes every interpolated value", () => {
    const email = buildInvitationEmail({
      ...base,
      inviteeName: '<script>alert("x")</script>',
      inviterName: "Eric & <b>Co</b>",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Eric &amp; &lt;b&gt;Co&lt;/b&gt;");
  });

  it("keeps the subject on a single line", () => {
    const email = buildInvitationEmail({ ...base, inviterName: "Eric\r\nBcc: evil@example.com" });

    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.subject).toContain("Eric Bcc: evil@example.com");
  });

  it("falls back to English when the stored locale is unknown", () => {
    const email = buildInvitationEmail({
      ...base,
      locale: "xx" as unknown as InvitationEmailInput["locale"],
    });

    expect(email.subject).toBe("Eric invited you to 027Apps");
  });

  it("falls back to UTC when the time zone is invalid", () => {
    const email = buildInvitationEmail({ ...base, timeZone: "Not/AZone" });

    expect(email.html).toContain("18 de noviembre de 2026");
  });

  it("includes the light and dark lockups from the instance URL", () => {
    const email = buildInvitationEmail(base);

    expect(email.html).toContain("https://027apps.ericrf.com/brand/email-lockup-light.png");
    expect(email.html).toContain("https://027apps.ericrf.com/brand/email-lockup-dark.png");
  });
});

describe("escapeHtml", () => {
  it("covers the five characters that break HTML", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("invitationUrl", () => {
  it("encodes the token and trims trailing slashes", () => {
    expect(invitationUrl("https://x.test///", "a/b")).toBe("https://x.test/invite/a%2Fb");
  });
});
