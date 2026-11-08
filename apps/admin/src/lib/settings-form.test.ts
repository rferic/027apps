import { describe, expect, it } from "vitest";
import { failureFrom } from "./mutation-result";
import type { SettingRow } from "./setting-types";
import {
  CORS_SETTING_KEY,
  corsChangeLocksOut,
  corsKeepsOrigin,
  corsUpdateLocksOut,
  encodeSettingValue,
  initialSettingsDraft,
  parseSettingValue,
  revertEnabledLocales,
  updatesFromDraft,
} from "./settings-form";

function setting(overrides: Partial<SettingRow>): SettingRow {
  return {
    key: "instance.name",
    category: "instance",
    label: "Instance name",
    help: "",
    type: "string",
    isSecret: false,
    isPublic: true,
    superAdminOnly: false,
    readOnly: false,
    sortOrder: 10,
    updatedBy: null,
    updatedAt: "2026-11-01T10:00:00.000Z",
    value: "027Apps",
    ...overrides,
  };
}

const NAME = setting({});
const TIMEOUT = setting({
  key: "security.jwt_expiry",
  category: "security",
  type: "int",
  value: 900,
  superAdminOnly: true,
  readOnly: true,
});
const LOCALES = setting({
  key: "localization.enabled_locales",
  category: "localization",
  type: "locales",
  value: ["en", "es"],
});
const CORS = setting({
  key: "security.cors_allowlist",
  category: "security",
  type: "array",
  value: ["https://a.test"],
});
const SECRET = setting({
  key: "notifications.push.fcm_service_account",
  category: "notifications",
  type: "json",
  isSecret: true,
  isPublic: false,
  value: undefined,
  configured: true,
});

const ALL = [NAME, TIMEOUT, LOCALES, CORS, SECRET];

describe("initialSettingsDraft / encodeSettingValue", () => {
  it("encodes every type into the text the form edits", () => {
    expect(encodeSettingValue(NAME)).toBe("027Apps");
    expect(encodeSettingValue(TIMEOUT)).toBe("900");
    expect(encodeSettingValue(LOCALES)).toBe("en, es");
    expect(encodeSettingValue(CORS)).toBe("https://a.test");
    // Secrets never expose a value, configured or not.
    expect(encodeSettingValue(SECRET)).toBe("");
    expect(initialSettingsDraft(ALL)).toEqual({
      "instance.name": "027Apps",
      "security.jwt_expiry": "900",
      "localization.enabled_locales": "en, es",
      "security.cors_allowlist": "https://a.test",
      "notifications.push.fcm_service_account": "",
    });
  });

  it("renders a null value as an empty field", () => {
    expect(encodeSettingValue(setting({ key: "instance.public_url", type: "url", value: null }))).toBe("");
  });
});

describe("parseSettingValue", () => {
  it("parses ints, locale lists and origin lists", () => {
    expect(parseSettingValue(TIMEOUT, "1200")).toBe(1200);
    expect(parseSettingValue(LOCALES, "en, es, gl")).toEqual(["en", "es", "gl"]);
    expect(parseSettingValue(CORS, "https://a.test\nhttps://b.test")).toEqual([
      "https://a.test",
      "https://b.test",
    ]);
  });

  it("keeps a non-numeric int as text so the API rejects it with the key", () => {
    expect(parseSettingValue(TIMEOUT, "soon")).toBe("soon");
  });
});

describe("updatesFromDraft", () => {
  it("sends nothing when nothing changed", () => {
    expect(updatesFromDraft(ALL, initialSettingsDraft(ALL))).toEqual([]);
  });

  it("sends only the keys the user changed", () => {
    const draft = initialSettingsDraft(ALL);
    draft["instance.name"] = "Familia";

    expect(updatesFromDraft(ALL, draft)).toEqual([{ key: "instance.name", value: "Familia" }]);
  });

  it("skips read-only keys even if the draft carries a value", () => {
    const draft = initialSettingsDraft(ALL);
    draft["security.jwt_expiry"] = "3600";

    expect(updatesFromDraft(ALL, draft)).toEqual([]);
  });

  it("keeps an empty secret (input vacío = conservar) and sends a filled one", () => {
    const empty = initialSettingsDraft(ALL);
    expect(updatesFromDraft([SECRET], empty)).toEqual([]);

    const filled = { ...empty, [SECRET.key]: '{"type":"service_account"}' };
    expect(updatesFromDraft([SECRET], filled)).toEqual([
      { key: SECRET.key, value: '{"type":"service_account"}' },
    ]);
  });

  it("compares parsed values, not formatting", () => {
    const draft = initialSettingsDraft(ALL);
    draft["localization.enabled_locales"] = "en,es";
    draft["security.cors_allowlist"] = "https://a.test\n";

    expect(updatesFromDraft([LOCALES, CORS], draft)).toEqual([]);
  });

  it("sends the enabled locales as an array in the batch", () => {
    const draft = initialSettingsDraft(ALL);
    draft["localization.enabled_locales"] = "en, es, gl";

    expect(updatesFromDraft([LOCALES], draft)).toEqual([
      { key: "localization.enabled_locales", value: ["en", "es", "gl"] },
    ]);
  });
});

describe("revertEnabledLocales", () => {
  it("restores the saved selection after a coherence failure", () => {
    const draft = initialSettingsDraft(ALL);
    draft["localization.enabled_locales"] = "en";

    const reverted = revertEnabledLocales([LOCALES], draft);

    expect(reverted["localization.enabled_locales"]).toBe("en, es");
    // Other unsaved edits stay untouched.
    expect(reverted["instance.name"]).toBe(draft["instance.name"]);
  });
});

describe("cors guard", () => {
  const PANEL = "https://panel.example.com";

  it("keeps the origin only on an exact match of the stored list", () => {
    expect(corsKeepsOrigin([PANEL, "https://other.test"], PANEL)).toBe(true);
    expect(corsKeepsOrigin([`${PANEL}/`], PANEL)).toBe(false);
    expect(corsKeepsOrigin([], PANEL)).toBe(false);
    expect(corsKeepsOrigin(undefined, PANEL)).toBe(false);
  });

  it("does not lock out when the list was not changed", () => {
    // Saving instance.name or a list the user did not touch never warns.
    expect(corsUpdateLocksOut(ALL, [{ key: "instance.name", value: "Familia" }], PANEL)).toBe(false);
    expect(corsUpdateLocksOut(ALL, [], PANEL)).toBe(false);
  });

  it("warns when the change removes the origin the panel uses", () => {
    const saved = setting({
      key: CORS_SETTING_KEY,
      category: "security",
      type: "array",
      value: ["https://a.test", "https://b.test"],
    });

    expect(
      corsUpdateLocksOut([saved], [{ key: CORS_SETTING_KEY, value: ["https://a.test"] }], "https://b.test"),
    ).toBe(true);
  });

  it("does not warn when the new list still contains the panel origin", () => {
    expect(
      corsChangeLocksOut([PANEL], [PANEL, "https://a.test"], PANEL),
    ).toBe(false);
    expect(
      corsUpdateLocksOut(
        [setting({ key: CORS_SETTING_KEY, category: "security", type: "array", value: [PANEL] })],
        [{ key: CORS_SETTING_KEY, value: [PANEL, "https://b.test"] }],
        PANEL,
      ),
    ).toBe(false);
  });

  it("does not warn for an origin that was never allowed", () => {
    // Empty allowlist (the default): editing it cannot take away API access
    // this browser did not have.
    expect(
      corsUpdateLocksOut(ALL, [{ key: CORS_SETTING_KEY, value: ["https://b.test"] }], PANEL),
    ).toBe(false);
  });
});

describe("corsKeepsOrigin with the parsed draft", () => {
  it("compares against the JSON array the batch sends, not the textarea text", () => {
    const draft = initialSettingsDraft(ALL);
    draft[CORS_SETTING_KEY] = "https://a.test\nhttps://panel.example.com";
    const updates = updatesFromDraft(ALL, draft);

    expect(corsUpdateLocksOut(ALL, updates, "https://panel.example.com")).toBe(false);
  });
});

describe("failureFrom", () => {
  it("keeps the settings key of a batch validation failure", () => {
    const failure = failureFrom({
      error: {
        code: "validation_failed",
        request_id: "req-400",
        details: {
          key: "localization.timezone",
          formErrors: ["not a valid IANA timezone"],
          fieldErrors: {},
        },
      },
    });

    expect(failure).toEqual({
      ok: false,
      code: "validation_failed",
      requestId: "req-400",
      details: {
        key: "localization.timezone",
        formErrors: ["not a valid IANA timezone"],
        fieldErrors: {},
      },
    });
  });
});
