// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkCard } from "@lumos/shared";
import { clearLinkCache } from "../lib/link-cache";
import { LinkPane } from "./LinkPane";

const opened = vi.hoisted(() => ({ openLinkInApp: vi.fn(async () => {}) }));
vi.mock("../lib/link-viewer", () => ({ openLinkInApp: opened.openLinkInApp }));

beforeEach(clearLinkCache);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  opened.openLinkInApp.mockClear();
});

const PAGE_URL = "https://example.com/article-of-the-day";

function card(text = "Readable body text."): LinkCard {
  return {
    media: { url: PAGE_URL, kind: "page" },
    title: "Example page",
    site: "example.com",
    description: "A description",
    image: null,
    text,
    truncated: false,
  };
}

/** A fetch that answers `/link` with the given card. */
function stubLink(cardToReturn: LinkCard): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ link: cardToReturn }) }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("LinkPane - what plays without the daemon", () => {
  it("embeds a YouTube link through the no-cookie player", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<LinkPane url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" connection="demo" />);

    const frame = screen.getByTitle("Video from youtube.com");
    expect(frame.getAttribute("src")).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an Instagram reel playable offline and says what is missing", () => {
    render(<LinkPane url="https://www.instagram.com/reel/CabcDEF123/" connection="demo" />);

    expect(screen.getByTitle("Instagram post or reel from instagram.com")).toBeDefined();
    expect(
      screen.getByText(/The caption and thumbnail come from the daemon/, { exact: false }),
    ).toBeDefined();
  });

  it("renders a linked image as the image, named after its file", () => {
    render(<LinkPane url="https://example.com/pics/cover.png" connection="demo" />);

    const image = screen.getByRole("img", { name: "cover.png" });
    expect(image.getAttribute("src")).toBe("https://example.com/pics/cover.png");
  });

  it("opens a linked image in the in-app viewer", async () => {
    render(<LinkPane url="https://example.com/pics/cover.png" connection="demo" />);
    fireEvent.click(screen.getByRole("button", { name: "Open the image" }));

    await waitFor(() =>
      expect(opened.openLinkInApp).toHaveBeenCalledWith("https://example.com/pics/cover.png"),
    );
  });
});

describe("LinkPane - reading a page", () => {
  it("says it is reading, then shows what the page says about itself", async () => {
    stubLink(card());
    render(<LinkPane url={PAGE_URL} connection="daemon" />);

    expect(screen.getByText("Reading the page…")).toBeDefined();
    expect(await screen.findByText("Example page")).toBeDefined();
    expect(screen.getByText("A description")).toBeDefined();
    expect(screen.getByText("Readable body text.")).toBeDefined();
  });

  it("opens the source page from the text reader in the in-app viewer", async () => {
    stubLink({ ...card(), truncated: true });
    render(<LinkPane url={PAGE_URL} connection="daemon" />);
    fireEvent.click(await screen.findByRole("button", { name: "Open the whole page" }));

    expect(opened.openLinkInApp).toHaveBeenCalledWith(PAGE_URL);
  });

  it("says a page needs the daemon when it is not running, and asks nobody", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<LinkPane url={PAGE_URL} connection="demo" />);

    expect(screen.getByText(/Reading the page needs the daemon/, { exact: false })).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the daemon's refusal, and Retry really asks again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ link: card("Second attempt") }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<LinkPane url={PAGE_URL} connection="daemon" />);

    expect(await screen.findByText("GET /link -> 400")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Second attempt")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("says where the text was cut when the page was longer than the reader", async () => {
    stubLink({ ...card(), truncated: true });
    render(<LinkPane url={PAGE_URL} connection="daemon" />);

    await waitFor(() => expect(screen.getByText(/The text was cut here/)).toBeDefined());
  });

  it("says so when the page had no readable text", async () => {
    stubLink({ ...card(), text: "" });
    render(<LinkPane url={PAGE_URL} connection="daemon" />);

    expect(await screen.findByText(/That page had no readable text/)).toBeDefined();
  });
});
