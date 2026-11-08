import { describe, expect, it } from "vitest";
import { createFormReducer, INITIAL_CREATE_FORM_STATE } from "./use-create-form";

const created = createFormReducer(INITIAL_CREATE_FORM_STATE, {
  type: "created",
  result: "027_svc_secret",
});

describe("createFormReducer", () => {
  it("starts on an empty form without a result", () => {
    expect(INITIAL_CREATE_FORM_STATE).toMatchObject({
      phase: "form",
      result: null,
      copied: false,
      copyFailed: false,
      confirmingAnother: false,
      submitting: false,
      error: null,
      fieldErrors: {},
      formKey: 0,
    });
  });

  it("keeps the one-time result on the created step", () => {
    expect(created).toMatchObject({
      phase: "created",
      result: "027_svc_secret",
      submitting: false,
      copied: false,
    });
    expect(created.formKey).toBeGreaterThan(INITIAL_CREATE_FORM_STATE.formKey);
  });

  it("drops a previous secret or token when the form is reset", () => {
    const reset = createFormReducer(created, { type: "reset" });

    expect(reset).toMatchObject({
      phase: "form",
      result: null,
      copied: false,
      copyFailed: false,
      confirmingAnother: false,
      submitting: false,
      error: null,
      fieldErrors: {},
    });
    expect(reset.formKey).toBeGreaterThan(created.formKey);
  });

  it("clears a previous error and its field errors on reset", () => {
    const failed = createFormReducer(created, {
      type: "failed",
      error: { ok: false, code: "validation_failed" },
      fieldErrors: { email: ["nope"] },
    });

    expect(createFormReducer(failed, { type: "reset" })).toMatchObject({
      error: null,
      fieldErrors: {},
      result: null,
    });
  });

  it("tracks the copy flags as opposites", () => {
    const copied = createFormReducer(created, { type: "copy", ok: true });
    expect(copied).toMatchObject({ copied: true, copyFailed: false });

    const failed = createFormReducer(copied, { type: "copy", ok: false });
    expect(failed).toMatchObject({ copied: false, copyFailed: true });
  });

  it("asks before discarding an uncopied result", () => {
    const asked = createFormReducer(created, { type: "another-requested" });

    expect(asked).toMatchObject({
      phase: "created",
      result: "027_svc_secret",
      confirmingAnother: true,
    });
  });

  it("resets a copied result without asking", () => {
    const copied = createFormReducer(created, { type: "copy", ok: true });
    const reset = createFormReducer(copied, { type: "another-confirmed" });

    expect(reset).toMatchObject({ phase: "form", result: null, copied: false });
  });

  it("cancels the confirmation without dropping the result", () => {
    const asked = createFormReducer(created, { type: "another-requested" });
    const cancelled = createFormReducer(asked, { type: "another-cancelled" });

    expect(cancelled).toMatchObject({
      phase: "created",
      result: "027_svc_secret",
      confirmingAnother: false,
    });
  });

  it("clears one field error while keeping the rest", () => {
    const failed = createFormReducer(created, {
      type: "failed",
      error: null,
      fieldErrors: { role_cap: ["Choose a role cap."], name: ["Required"] },
    });

    expect(createFormReducer(failed, { type: "clear-field-error", field: "role_cap" })).toMatchObject(
      {
        fieldErrors: { name: ["Required"] },
      },
    );
  });
});
