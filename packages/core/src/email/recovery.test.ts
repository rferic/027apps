import { describe, expect, it } from "vitest";
import { buildRecoveryEmail } from "./recovery";
import type { RecoveryEmailInput } from "./types";

const link =
  "https://familia.test/auth/confirm?token_hash=abc123&type=recovery&next=%2Freset-password";

const base: RecoveryEmailInput = {
  locale: "es",
  name: "María",
  instanceName: "Familia Pérez",
  publicUrl: "https://familia.test/",
  link,
};

describe("recovery email", () => {
  it("renders the localized copy with the confirmation link", () => {
    const email = buildRecoveryEmail(base);

    expect(email.subject).toBe("Restablece tu contraseña de Familia Pérez");
    expect(email.html).toContain("Hola, María");
    expect(email.html).toContain("Elegir una contraseña nueva");
    expect(email.html).toContain("caduca en 1 hora");
    expect(email.html).toContain(link.replace(/&/g, "&amp;"));
    expect(email.text).toContain(link);
    expect(email.text).toContain("tu contraseña no ha cambiado");
  });

  it("localizes the same message in English", () => {
    const email = buildRecoveryEmail({ ...base, locale: "en" });

    expect(email.subject).toBe("Reset your Familia Pérez password");
    expect(email.html).toContain("Hi María");
    expect(email.html).toContain("Choose a new password");
  });

  it("escapes every interpolated value", () => {
    const email = buildRecoveryEmail({
      ...base,
      name: '<script>alert("x")</script>',
      instanceName: "Familia & <b>Pérez</b>",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Familia &amp; &lt;b&gt;Pérez&lt;/b&gt;");
  });

  it("keeps the subject on a single line", () => {
    const email = buildRecoveryEmail({ ...base, instanceName: "Familia\r\nBcc: evil@example.com" });
    expect(email.subject).not.toMatch(/[\r\n]/);
  });
});
