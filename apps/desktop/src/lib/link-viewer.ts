import { invoke, isTauri } from "@tauri-apps/api/core";

/** Validate a link before passing it to a native webview or browser tab. */
export function linkViewerUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("This link is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS links can open in Lumos.");
  }
  if (url.username || url.password) {
    throw new Error("Links with embedded credentials cannot open in Lumos.");
  }

  return url;
}

/** Open a page in its own native webview window, or a new tab in the browser preview. */
export async function openLinkInApp(rawUrl: string): Promise<void> {
  const url = linkViewerUrl(rawUrl);
  if (isTauri()) {
    await invoke<void>("open_link_viewer", { url: url.href });
    return;
  }

  // `noopener` intentionally makes window.open return null, even when the tab opened.
  window.open(url.href, "_blank", "noopener,noreferrer");
}
