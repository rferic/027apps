import { AndroidIcon } from "@/components/landing/android-icon";

/**
 * Destination of every download button: the instance streams the latest APK
 * itself, so the visitor is never sent to GitHub (see `app/download/android`).
 */
export const DOWNLOAD_URL = "/download/android";

/**
 * The landing's primary call to action. One component keeps the label, the
 * platform icon and the destination identical wherever it appears; `.btn`
 * already centres it with a 40 px minimum height, so the icon never shifts the
 * text baseline.
 *
 * `version` comes from the same lookup that serves the download, so it is the
 * version the visitor will actually get and nobody has to edit a number.
 */
export function DownloadButton({ label, version }: { label: string; version?: string | null }) {
  return (
    <a className="btn primary" href={DOWNLOAD_URL}>
      <AndroidIcon />{" "}
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        {version ? (
          <span className="text-[10px] font-normal opacity-70 tabular-nums">{version}</span>
        ) : null}
      </span>{" "}
    </a>
  );
}
