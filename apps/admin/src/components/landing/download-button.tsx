import { AndroidIcon } from "@/components/landing/android-icon";

/** Destination of every download button: the signed APK on GitHub Releases. */
export const DOWNLOAD_URL = "https://github.com/rferic/027apps/releases";

/**
 * The landing's primary call to action. One component keeps the label, the
 * platform icon and the destination identical wherever it appears; `.btn`
 * already centres it with a 40 px minimum height, so the icon never shifts the
 * text baseline.
 */
export function DownloadButton({ label }: { label: string }) {
  return (
    <a className="btn primary" href={DOWNLOAD_URL}>
      <AndroidIcon />{" "}
      {label}{" "}
    </a>
  );
}
