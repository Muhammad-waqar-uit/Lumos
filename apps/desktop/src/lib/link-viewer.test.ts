// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { linkViewerUrl, openLinkInApp } from "./link-viewer";

const originalOpen = window.open;

afterEach(() => {
  vi.unstubAllGlobals();
  window.open = originalOpen;
});

describe("linkViewerUrl", () => {
  it("accepts HTTP and HTTPS links", () => {
    expect(linkViewerUrl("https://example.com/a?b=c").href).toBe("https://example.com/a?b=c");
    expect(linkViewerUrl("http://localhost:3000/").href).toBe("http://localhost:3000/");
  });

  it.each(["javascript:alert(1)", "file:///etc/passwd", "data:text/html,hello", "not a URL"])(
    "rejects unsafe or invalid URL %s",
    (url) => {
      expect(() => linkViewerUrl(url)).toThrow();
    },
  );

  it("rejects credentials embedded in a URL", () => {
    expect(() => linkViewerUrl("https://user:password@example.com")).toThrow(/credentials/);
  });

  it("opens a validated URL in a new browser tab when running outside Tauri", async () => {
    const openedWindow = {} as Window;
    const open = vi.fn(() => openedWindow);
    window.open = open;

    await openLinkInApp("https://example.com/article");

    expect(open).toHaveBeenCalledWith(
      "https://example.com/article",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("does not grant the opened page access to its opener", async () => {
    const open = vi.fn(() => null);
    window.open = open;

    await expect(openLinkInApp("https://example.com")).resolves.toBeUndefined();
    expect(open).toHaveBeenCalledWith("https://example.com/", "_blank", "noopener,noreferrer");
  });
});
