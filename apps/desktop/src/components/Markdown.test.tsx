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

describe("Markdown headings", () => {
  it("gives h2 and h3 the ids the Contents list points at", () => {
    const { container } = render(<Markdown source={"## Hello, world!\n\n### What is next"} />);

    expect(container.querySelector("h2")?.id).toBe("hello-world");
    expect(container.querySelector("h3")?.id).toBe("what-is-next");
  });

  it("keeps two headings of the same name apart", () => {
    const { container } = render(<Markdown source={"## Notes\n\n## Notes"} />);
    const ids = Array.from(container.querySelectorAll("h2")).map((heading) => heading.id);

    expect(ids).toEqual(["notes", "notes-2"]);
  });

  it("does not read a heading out of a fenced line", () => {
    const { container } = render(<Markdown source={"```md\n## Not a heading\n```"} />);

    expect(container.querySelector("h2")).toBeNull();
  });
});
