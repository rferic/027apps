import { describe, expect, it } from "vitest";
import { entryGate } from "./instance-gate";

const INSTALLED = { installed: true, setupIncomplete: false, hasSession: false };
const INSTALLED_WITH_SESSION = { installed: true, setupIncomplete: false, hasSession: true };
const UNINSTALLED = { installed: false, setupIncomplete: false, hasSession: false };
const ANONYMOUS_SESSION = { installed: false, setupIncomplete: false, hasSession: true };
const MID_SETUP = { installed: true, setupIncomplete: true, hasSession: true };
const MID_SETUP_NO_SESSION = { installed: true, setupIncomplete: true, hasSession: false };

describe("entryGate", () => {
  it("sends an uninstalled instance to /setup", () => {
    expect(entryGate("/", UNINSTALLED)).toBe("/setup");
    expect(entryGate("/", ANONYMOUS_SESSION)).toBe("/setup");
  });

  it("sends an installed instance without session to /login", () => {
    expect(entryGate("/", INSTALLED)).toBe("/login");
  });

  it("lets an installed instance with session into the panel", () => {
    expect(entryGate("/", INSTALLED_WITH_SESSION)).toBeNull();
    expect(entryGate("/", MID_SETUP)).toBeNull();
  });

  it("keeps the wizard open while the instance is uninstalled", () => {
    expect(entryGate("/setup", UNINSTALLED)).toBeNull();
  });

  it("requires the super_admin session for the wizard steps 3–5", () => {
    expect(entryGate("/setup", MID_SETUP_NO_SESSION)).toBe("/login");
    expect(entryGate("/setup", INSTALLED)).toBe("/login");
  });

  it("keeps the wizard open until the preferences are written", () => {
    expect(entryGate("/setup", MID_SETUP)).toBeNull();
  });

  it("closes the wizard once setup is complete", () => {
    expect(entryGate("/setup", INSTALLED_WITH_SESSION)).toBe("/");
  });

  it("points /login at the wizard while the instance is uninstalled", () => {
    expect(entryGate("/login", UNINSTALLED)).toBe("/setup");
    expect(entryGate("/login", INSTALLED)).toBeNull();
    expect(entryGate("/login", MID_SETUP)).toBeNull();
  });

  it("does not gate other paths", () => {
    expect(entryGate("/dashboard", UNINSTALLED)).toBeNull();
    expect(entryGate("/dashboard", INSTALLED)).toBeNull();
  });
});
