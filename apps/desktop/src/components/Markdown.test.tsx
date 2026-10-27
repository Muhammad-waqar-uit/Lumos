// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "./Markdown";

const opened = vi.hoisted(() => ({ openLinkInApp: vi.fn(async () => {}) }));
vi.mock("../lib/link-viewer", () => ({ openLinkInApp: opened.openLinkInApp }));

afterEach(() => {
  cleanup();
  opened.openLinkInApp.mockClear();
});

describe("Markdown links", () => {
  it("opens an HTTP link in the in-app viewer rather than navigating the Lumos window", () => {
    render(<Markdown source="[read it](https://example.com/article)" />);
    const link = screen.getByRole("button", { name: "read it" });
    fireEvent.click(link);

    expect(opened.openLinkInApp).toHaveBeenCalledWith("https://example.com/article");
  });

  it("does not render links with non-web schemes as navigable links", () => {
    render(<Markdown source="[run](javascript:alert%281%29)" />);

    expect(screen.queryByRole("link", { name: "run" })).toBeNull();
    expect(opened.openLinkInApp).not.toHaveBeenCalled();
  });
});
