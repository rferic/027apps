import { describe, expect, it } from "vitest";
import { inviteErrorHeading } from "./invite-errors";

const MESSAGES = {
  "This invitation link is not valid.": "Este enlace de invitación no es válido.",
  "This invitation has expired. Ask an administrator for a new one.":
    "Esta invitación ha caducado. Pide una nueva a un administrador.",
  "This invitation has already been used.": "Esta invitación ya se ha utilizado.",
  "This account is deactivated. Contact an administrator.":
    "Esta cuenta está desactivada. Contacta con un administrador.",
  "Use the email address this invitation was sent to.":
    "Usa la dirección de email a la que se envió esta invitación.",
  "Too many attempts. Wait a minute and try again.":
    "Demasiados intentos. Espera un minuto y vuelve a intentarlo.",
  "We couldn't redeem this invitation. Check your connection and try again.":
    "No pudimos canjear esta invitación. Comprueba tu conexión y vuelve a intentarlo.",
};

describe("inviteErrorHeading", () => {
  it.each([
    ["not_found", "This invitation link is not valid."],
    ["invitation_expired", "This invitation has expired. Ask an administrator for a new one."],
    ["invitation_used", "This invitation has already been used."],
    ["conflict", "This account is deactivated. Contact an administrator."],
    ["validation_failed", "Use the email address this invitation was sent to."],
    ["rate_limited", "Too many attempts. Wait a minute and try again."],
  ])("maps %s to its own heading", (code, expected) => {
    expect(inviteErrorHeading({ ok: false, code }, {})).toBe(expected);
  });

  it("translates the heading with the supplied dictionary", () => {
    expect(inviteErrorHeading({ ok: false, code: "not_found" }, MESSAGES)).toBe(
      "Este enlace de invitación no es válido.",
    );
  });

  it("falls back to the generic heading for an unknown or missing code", () => {
    const generic = "We couldn't redeem this invitation. Check your connection and try again.";
    expect(inviteErrorHeading({ ok: false }, {})).toBe(generic);
    expect(inviteErrorHeading(null, {})).toBe(generic);
    expect(inviteErrorHeading({ ok: false, code: "internal" }, {})).toBe(generic);
  });
});
