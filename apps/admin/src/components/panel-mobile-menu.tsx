"use client";

import { useRef } from "react";
import { t } from "@027apps/i18n/t.js";
import type { TranslationMap } from "@027apps/i18n/types.js";
import { cn } from "@/lib/cn";
import type { PanelRole } from "@/lib/panel-guard";
import { CloseIcon, MenuIcon } from "./panel-icons";
import { PanelNav } from "./panel-nav";

/**
 * Mobile navigation drawer. A native `<dialog>` gives the modal behaviour for
 * free — focus trap, top layer, Escape — so no dependency or custom focus
 * management is needed. The trigger lives in the header and is hidden at `lg`.
 */
export function PanelMobileMenu({ role, messages }: { role: PanelRole; messages: TranslationMap }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-label={t("Open menu", messages)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border text-foreground focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      {/* Documented exception: the drawer is not a `Dialog`. It needs a fixed
          full-height side layout instead of the centered modal box, so it
          repeats the modal text/background tokens here. */}
      <dialog
        ref={dialogRef}
        aria-label={t("Menu", messages)}
        className={cn(
          "fixed inset-y-0 left-0 m-0 h-full max-h-none w-72 max-w-[85vw] overflow-y-auto border-0 bg-surface p-4 text-foreground",
          "backdrop:bg-foreground/40",
        )}
        onClick={(event) => {
          // The dialog fills the top layer; a click on its own box (not on a
          // child) means the backdrop was hit.
          if (event.target === dialogRef.current) close();
        }}
      >
        <div className="flex items-center justify-between gap-2 pb-3">
          <h2 className="text-sm font-semibold">{t("Menu", messages)}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={t("Close menu", messages)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-muted-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <PanelNav role={role} messages={messages} variant="drawer" onNavigate={close} />
      </dialog>
    </>
  );
}
