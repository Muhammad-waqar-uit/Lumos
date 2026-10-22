// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Folder, VaultEntry } from "@lumos/shared";
import { SearchModal } from "./SearchModal";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function entry(title: string, overrides: Partial<VaultEntry> = {}): VaultEntry {
  const name = `${title.toLowerCase().replace(/\s+/g, "-")}.md`;
  return {
    title,
    folder: "Ideas" as Folder,
    file: `/vault/Ideas/${name}`,
    name,
    created: "2026-10-20",
    tags: ["ideas"],
    excerpt: "an excerpt",
    ...overrides,
  };
}

const ALPHA = entry("Alpha note");
const BETA = entry("Beta note");

/** A fetch that answers the body search with the given notes. */
function stubBodySearch(notes: VaultEntry[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ notes }) }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderModal(overrides: Partial<Parameters<typeof SearchModal>[0]> = {}) {
  const props = {
    entries: [ALPHA, BETA],
    recent: [],
    connection: "daemon" as const,
    onOpen: () => {},
    onClose: () => {},
    ...overrides,
  };
  render(<SearchModal {...props} />);
  return props;
}

const field = (): HTMLElement => screen.getByRole("searchbox", { name: "Search the vault" });
const type = (text: string): void => {
  fireEvent.change(field(), { target: { value: text } });
};

describe("SearchModal - an empty field", () => {
  it("explains what can be searched when there is nothing recent", () => {
    renderModal();
    expect(
      screen.getByText("Search titles, tags and previews. Body text needs the daemon."),
    ).toBeDefined();
  });

  it("offers the session's recent notes, newest first", () => {
    renderModal({ recent: [BETA, ALPHA] });

    expect(screen.getByText("Recent")).toBeDefined();
    const rows = Array.from(document.querySelectorAll("li button")).map((b) => b.textContent ?? "");
    expect(rows[0]).toContain("Beta note");
    expect(rows[1]).toContain("Alpha note");
  });

  it("opens the selected recent note with Enter", () => {
    const onOpen = vi.fn();
    renderModal({ recent: [BETA, ALPHA], onOpen });

    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "Enter" });

    expect(onOpen).toHaveBeenCalledWith("Ideas/alpha-note.md");
  });

  it("closes on Escape from anywhere in the dialog", () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});

describe("SearchModal - typing", () => {
  it("ranks the loaded notes and opens the first one on Enter", () => {
    const onOpen = vi.fn();
    renderModal({ onOpen });

    type("beta");
    fireEvent.keyDown(field(), { key: "Enter" });

    expect(onOpen).toHaveBeenCalledWith("Ideas/beta-note.md");
  });

  it("says when nothing matches, and keeps the selection inside the results", () => {
    const onOpen = vi.fn();
    renderModal({ connection: "demo", onOpen });

    type("zzzz");
    expect(screen.getByText(/No notes match/)).toBeDefined();

    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("waits for the body search before saying there is no match", async () => {
    stubBodySearch([]);
    renderModal();

    type("zzzz");
    expect(screen.getByText("Searching…")).toBeDefined();

    expect(await screen.findByText(/No notes match/)).toBeDefined();
  });

  it("says a body search needs the daemon when it is offline, and never asks it", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderModal({ connection: "demo" });

    type("kyoto");

    expect(screen.getByText("Body search needs the daemon")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds a note the daemon found in its body, marked as such", async () => {
    const kyoto = entry("A trip to Kyoto", { tags: [] });
    stubBodySearch([kyoto]);
    renderModal({ entries: [] });

    type("kyoto");

    expect(await screen.findByText("in the body")).toBeDefined();
    expect(screen.getByText("A trip to Kyoto")).toBeDefined();
  });

  it("says the body search failed while keeping what the local index found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );
    renderModal();

    type("alpha");

    await waitFor(() => expect(screen.getByText("Body search failed")).toBeDefined());
    expect(screen.getByText("Alpha note")).toBeDefined();
  });
});
