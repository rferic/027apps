/**
 * Copies text to the clipboard. `navigator.clipboard` only exists in secure
 * contexts (HTTPS or localhost), so a phone opening the panel over plain
 * HTTP on the LAN has no such API. The fallback uses a hidden textarea and
 * `document.execCommand("copy")`, which does not depend on `navigator.clipboard`.
 */

export interface ClipboardEnv {
  isSecureContext: boolean;
  hasClipboard: boolean;
}

/** Pure check: the async Clipboard API is usable only in a secure context. */
export function canUseClipboardApi(env: ClipboardEnv): boolean {
  return env.isSecureContext && env.hasClipboard;
}

function currentClipboardEnv(): ClipboardEnv {
  return {
    isSecureContext: globalThis.isSecureContext === true,
    hasClipboard:
      typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function",
  };
}

function copyWithTextarea(text: string): boolean {
  if (typeof document === "undefined" || !document.body) return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

/** Resolves `true` when the text reached the clipboard, `false` otherwise. */
export async function copyText(text: string): Promise<boolean> {
  if (canUseClipboardApi(currentClipboardEnv())) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or focus lost: try the legacy path below.
    }
  }
  return copyWithTextarea(text);
}
