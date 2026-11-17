"use client";

import { useState } from "react";
import Link from "next/link";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { Button } from "@/components/ui/button";
import { cancelClass } from "@/components/ui/form";
import { SignInIcon } from "@/components/ui/sign-in-icon";
import { AndroidIcon } from "@/components/landing/android-icon";
import type { InviteVariant } from "@/lib/invite-variant";
import { InviteDetails, type InvitePublicView } from "./invite-details";
import { InviteForm } from "./invite-form";

type Step = "intro" | "download" | "retry" | "form";

interface InviteWizardProps {
  token: string;
  view: InvitePublicView;
  variant: InviteVariant;
  /** Instance origin, so the app knows where to redeem the token. */
  origin: string;
  releaseVersion: string | null;
  /** Locally generated SVG; only the desktop variant passes one. */
  qrSvg: string | null;
  messages: TranslationMap;
}

function Notice({ variant, messages }: { variant: InviteVariant; messages: TranslationMap }) {
  const title =
    variant === "ios"
      ? t("The app is Android only.", messages)
      : t("The app is Android only (8+).", messages);
  const detail =
    variant === "ios"
      ? t("On iPhone you can accept the invitation here, in the browser.", messages)
      : t("On iPhone or a computer you can accept the invitation in the browser.", messages);
  return (
    <div
      role="note"
      className="rounded-card border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
    >
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1">{detail}</p>
    </div>
  );
}

function Heading({ instance, messages }: { instance: string; messages: TranslationMap }) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{t("Accept your invitation", messages)}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("You have been invited to join", messages)} <strong>{instance}</strong>.
      </p>
    </>
  );
}

function FormStep({
  token,
  view,
  messages,
}: {
  token: string;
  view: InvitePublicView;
  messages: TranslationMap;
}) {
  return (
    <>
      <InviteDetails view={view} messages={messages} />
      <InviteForm token={token} view={view} messages={messages} />
      <Link href="/login" className={`${cancelClass} gap-1`}>
        <SignInIcon />
        {t("Sign in", messages)}
      </Link>
    </>
  );
}

function OpenButton({
  opening,
  onOpen,
  label,
  messages,
}: {
  opening: boolean;
  onOpen: () => void;
  label?: string;
  messages: TranslationMap;
}) {
  return (
    <Button variant="primary" className="min-h-11" disabled={opening} onClick={onOpen}>
      {opening ? t("Opening…", messages) : (label ?? t("Open in the app", messages))}
    </Button>
  );
}

function QrCard({
  qrSvg,
  origin,
  messages,
}: {
  qrSvg: string | null;
  origin: string;
  messages: TranslationMap;
}) {
  return (
    <aside className="flex h-fit flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold">{t("Open it on your phone", messages)}</h2>
      <p className="text-xs text-muted-foreground">
        {t(
          "Scan the QR with your phone's camera. If you have the app, it opens directly.",
          messages,
        )}
      </p>
      {qrSvg && (
        <div
          className="flex justify-center rounded-card p-2"
          // Locally generated SVG for the invitation URL: no user HTML. The SVG
          // paints its own white background and quiet zone.
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      )}
      <p className="break-all text-center font-mono text-[10px] text-muted-foreground">
        {origin.replace(/^https?:\/\//, "")}/invite/…
      </p>
      <p className="text-xs text-muted-foreground">
        {t(
          "You can also accept in this browser; the QR is a convenience, not a requirement.",
          messages,
        )}
      </p>
    </aside>
  );
}

/**
 * App-first wizard that never becomes a gate: "Continue in the browser" is on
 * every step, the app attempt is a click with a timeout and no automatic
 * redirect, and the form is the same on every platform.
 */
export function InviteWizard({
  token,
  view,
  variant,
  origin,
  releaseVersion,
  qrSvg,
  messages,
}: InviteWizardProps) {
  const [step, setStep] = useState<Step>(variant === "desktop" ? "form" : "intro");
  const [opening, setOpening] = useState(false);
  const [attempted, setAttempted] = useState(false);

  function openApp() {
    setAttempted(true);
    setOpening(true);
    try {
      window.location.href = `027apps://invite/${encodeURIComponent(token)}?instance=${encodeURIComponent(origin)}`;
    } catch {
      // A browser that refuses the scheme stays on this page.
    }
    window.setTimeout(() => setOpening(false), 1500);
  }

  if (variant === "desktop") {
    return (
      <div className="flex flex-col gap-4">
        <Notice variant={variant} messages={messages} />
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex flex-col gap-3">
            <Heading instance={view.instance_name} messages={messages} />
            <FormStep token={token} view={view} messages={messages} />
          </div>
          <QrCard qrSvg={qrSvg} origin={origin} messages={messages} />
        </div>
      </div>
    );
  }

  if (variant === "ios") {
    return (
      <div className="flex flex-col gap-4">
        <Notice variant={variant} messages={messages} />
        <Heading instance={view.instance_name} messages={messages} />
        {step === "form" ? (
          <FormStep token={token} view={view} messages={messages} />
        ) : (
          <>
            <InviteDetails view={view} messages={messages} />
            <Button variant="primary" className="min-h-11" onClick={() => setStep("form")}>
              {t("Continue in the browser", messages)}
            </Button>
          </>
        )}
      </div>
    );
  }

  if (step === "download") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t("Install 027Apps", messages)}</h1>
        <p className="text-sm text-muted-foreground">
          {t("The app is the recommended way in. Then reopen the invitation.", messages)}
        </p>
        <dl className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("App", messages)}</dt>
            <dd className="font-semibold">027Apps</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("Version", messages)}</dt>
            <dd>{releaseVersion ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t("File", messages)}</dt>
            <dd>APK</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Android</dt>
            <dd>{t("8.0 or later", messages)}</dd>
          </div>
        </dl>
        <p className="rounded-card border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t(
            "When installing, Android may ask you to allow installs from unknown sources for the browser. That is normal for an APK: the app is not on Play Store.",
            messages,
          )}
        </p>
        <div className="flex flex-col gap-2">
          <a
            href="/download/android"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control bg-android px-4 text-sm font-semibold text-android-foreground hover:opacity-90"
          >
            <AndroidIcon />
            {t("Download APK", messages)}
          </a>
          <Button variant="secondary" className="min-h-11" onClick={() => setStep("retry")}>
            {t("I have installed it", messages)}
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => setStep("intro")}>
            {t("Back", messages)}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("If you prefer not to install anything, you can", messages)}{" "}
          <button
            type="button"
            className="font-semibold text-accent underline"
            onClick={() => setStep("form")}
          >
            {t("continue in the browser", messages)}
          </button>
          .
        </p>
      </div>
    );
  }

  if (step === "retry") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t("Open the invitation in the app", messages)}</h1>
        <p className="text-sm text-muted-foreground">
          {t("If the app is installed, this button opens it with your invitation.", messages)}
        </p>
        <p className="rounded-card border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t(
            "If nothing opens, nothing happens: you can retry, download it again or continue here.",
            messages,
          )}
        </p>
        <div className="flex flex-col gap-2">
          <OpenButton opening={opening} onOpen={openApp} messages={messages} />
          <Button variant="secondary" className="min-h-11" onClick={() => setStep("download")}>
            {t("Download again", messages)}
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => setStep("form")}>
            {t("Continue in the browser", messages)}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="flex flex-col gap-4">
        <Notice variant={variant} messages={messages} />
        <Heading instance={view.instance_name} messages={messages} />
        <FormStep token={token} view={view} messages={messages} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Notice variant={variant} messages={messages} />
      <Heading instance={view.instance_name} messages={messages} />
      <InviteDetails view={view} messages={messages} />
      <div className="flex flex-col gap-2">
        <OpenButton opening={opening} onOpen={openApp} messages={messages} />
        <Button variant="android" className="min-h-11" onClick={() => setStep("download")}>
          <AndroidIcon />
          {t("Download for Android", messages)}
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={() => setStep("form")}>
          {t("Continue in the browser", messages)}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {attempted
          ? t("If the app does not open, use one of the options below.", messages)
          : t("If nothing opens, use one of the options below.", messages)}
      </p>
    </div>
  );
}
