import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FieldError, FormActions, FormAlert, FormField, FormSection } from "./form";

describe("FormField", () => {
  it("associates the label with the control by id", () => {
    const html = renderToStaticMarkup(
      <FormField id="email" label="Email">
        <input id="email" name="email" />
      </FormField>,
    );

    expect(html).toContain('for="email"');
    expect(html).toContain('id="email"');
    expect(html).toContain("Email");
  });

  it("renders the hint with its own id and muted styling", () => {
    const html = renderToStaticMarkup(
      <FormField id="email" label="Email" hint="We never share it.">
        <input id="email" name="email" />
      </FormField>,
    );

    expect(html).toContain('id="email-hint"');
    expect(html).toContain("We never share it.");
    expect(html).toContain("text-xs text-muted-foreground");
  });

  it("renders the error with its own id and destructive styling", () => {
    const html = renderToStaticMarkup(
      <FormField id="email" label="Email" error="Enter a valid email.">
        <input id="email" name="email" />
      </FormField>,
    );

    expect(html).toContain('id="email-error"');
    expect(html).toContain("Enter a valid email.");
    expect(html).toContain("text-xs font-semibold text-destructive");
  });

  it("respects explicit hint and error ids so aria-describedby keeps working", () => {
    const html = renderToStaticMarkup(
      <FormField
        id="member-display-name"
        label="Display name"
        hint="Between 1 and 80 characters."
        hintId="member-display-name-help"
        error="Required."
        errorId="member-display_name-error"
      >
        <input id="member-display-name" aria-describedby="member-display-name-help member-display_name-error" />
      </FormField>,
    );

    expect(html).toContain('id="member-display-name-help"');
    expect(html).toContain('id="member-display_name-error"');
    expect(html).toContain('aria-describedby="member-display-name-help member-display_name-error"');
  });

  it("omits hint and error nodes when they are empty", () => {
    const html = renderToStaticMarkup(
      <FormField id="email" label="Email">
        <input id="email" />
      </FormField>,
    );

    expect(html).not.toContain("-hint");
    expect(html).not.toContain("-error");
  });
});

describe("FieldError", () => {
  it("renders nothing without a message", () => {
    expect(renderToStaticMarkup(<FieldError id="x-error" />)).toBe("");
  });
});

describe("FormActions", () => {
  it("aligns the action row to the right with the shared height and gap", () => {
    const html = renderToStaticMarkup(
      <FormActions>
        <button type="button">Cancel</button>
      </FormActions>,
    );

    expect(html).toContain("justify-end");
    expect(html).toContain("min-h-11");
    expect(html).toContain("gap-2");
  });
});

describe("FormAlert", () => {
  it("renders a role alert with the translated code and the request id", () => {
    const html = renderToStaticMarkup(
      <FormAlert
        message="We couldn't save the changes."
        code="rate_limited"
        requestId="req-123"
        messages={{}}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("We couldn&#x27;t save the changes.");
    expect(html).toContain("Too many requests. Wait a moment and try again.");
    expect(html).toContain("req-123");
  });

  it("lists extra details and the optional retry link", () => {
    const html = renderToStaticMarkup(
      <FormAlert
        message="We couldn't load it."
        details={["First detail.", "Second detail."]}
        retryHref="/panel/members"
        messages={{}}
      />,
    );

    expect(html).toContain("First detail.");
    expect(html).toContain("Second detail.");
    expect(html).toContain('href="/panel/members"');
    expect(html).toContain("Try again");
  });

  it("prefers a caller-provided code label", () => {
    const html = renderToStaticMarkup(
      <FormAlert
        message="We couldn't save the changes."
        code="conflict"
        codeLabel="Your role change conflicts with the instance rules."
        messages={{}}
      />,
    );

    expect(html).toContain("Your role change conflicts with the instance rules.");
    expect(html).not.toContain("This change conflicts with the instance rules.");
  });
});

describe("FormSection", () => {
  it("groups content under a heading and a description", () => {
    const html = renderToStaticMarkup(
      <FormSection title="Instance" description="Instance identity and public links.">
        <p>Body</p>
      </FormSection>,
    );

    expect(html).toContain("<section");
    expect(html).toContain(">Instance</h2>");
    expect(html).toContain("Instance identity and public links.");
    expect(html).toContain("Body");
  });
});
