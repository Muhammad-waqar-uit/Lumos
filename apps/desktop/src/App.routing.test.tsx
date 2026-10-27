// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import type { GraphData, Note, VaultEntry } from "@lumos/shared";
import { createAppRouter } from "./router";
import { useVaultStore } from "./lib/store";

// The shell talks to one module, so the whole daemon is stood in for here - routing is what is
// under test, and the listing only has to be real enough to click a row of.
const fixtures = vi.hoisted(() => {
  const notes: VaultEntry[] = [
    {
      title: "Ship the release",
      folder: "Inbox",
      file: "C:/vault/Inbox/ship-the-release.md",
      name: "ship-the-release.md",
      created: "2026-10-20T08:00:00.000Z",
      tags: [],
      excerpt: "Steps for Friday.",
    },
    {
      title: "Morning walk",
      folder: "Ideas",
      file: "C:/vault/Ideas/morning-walk.md",
      name: "morning-walk.md",
      created: "2026-10-19T08:00:00.000Z",
      tags: ["health"],
      excerpt: "Routes to try before work.",
    },
  ];
  const note: Note = {
    title: "Ship the release",
    folder: "Inbox",
    file: "C:/vault/Inbox/ship-the-release.md",
    frontmatter: {
      source: "whatsapp",
      created: "2026-10-20T08:00:00.000Z",
      tags: [],
      status: "seed",
    },
    content: "Steps for Friday.",
    problems: [],
  };
  return { notes, note };
});

vi.mock("./lib/api", () => ({
  getFolders: vi.fn(async () => [
    { folder: "Inbox", count: 1 },
    { folder: "Ideas", count: 1 },
  ]),
  getNotes: vi.fn(async () => fixtures.notes),
  getGraph: vi.fn(async (): Promise<GraphData> => ({ nodes: [], edges: [], unresolved: [] })),
  getNote: vi.fn(async () => fixtures.note),
  getTrash: vi.fn(async () => []),
  // The status bar reads the WhatsApp link as soon as the shell mounts, so it answers here too.
  getWhatsApp: vi.fn(async () => ({
    enabled: true,
    state: "connected" as const,
    since: null,
    error: null,
    lastAt: null,
    qr: null,
  })),
  connectWhatsApp: vi.fn(),
  disconnectWhatsApp: vi.fn(),
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  moveNote: vi.fn(),
  renameNote: vi.fn(),
  restoreNote: vi.fn(),
  emptyTrash: vi.fn(),
  saveNote: vi.fn(),
  updateNoteMeta: vi.fn(),
}));

afterEach(cleanup);

// The store is a module-level singleton, so it starts fresh for every case - a note opened in
// one test must not still be in the vault of the next.
beforeEach(() => {
  useVaultStore.setState({
    connection: "connecting",
    loading: true,
    folders: [],
    notes: [],
    graph: null,
    activeFolder: "All",
    query: "",
    tag: null,
  });
});

/** Render the whole shell at one address, and hand back the router that put it there. */
function renderAt(path: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  render(<RouterProvider router={router} />);
  return router;
}

describe("the shell's address", () => {
  it("opens the notes view at the plain root, with no pane parameters at all", async () => {
    const router = renderAt("/");
    expect(await screen.findByPlaceholderText("Search notes")).toBeTruthy();
    // The title is on the row, in the viewer's header, and inside the demo body as a markdown
    // heading; the level-2 header is the viewer's own, and is what proves a note is open.
    expect(screen.getByRole("heading", { level: 2, name: "Ship the release" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Trash" })).toBeNull();
    expect(router.state.location.search).toEqual({});
  });

  it("opens the trash from a deep link, and never the list beside it", async () => {
    const router = renderAt("/?view=trash");
    expect(await screen.findByText("The trash is empty.")).toBeTruthy();
    expect(screen.queryByPlaceholderText("Search notes")).toBeNull();
    expect(router.state.location.search.view).toBe("trash");
  });

  it("opens the insights pane from its tab, and never the list beside it", async () => {
    const router = renderAt("/");
    await screen.findByPlaceholderText("Search notes");

    fireEvent.click(screen.getByRole("tab", { name: "Stats" }));

    expect(router.state.location.search.view).toBe("insights");
    expect(await screen.findByRole("region", { name: "Vault insights" })).toBeTruthy();
    expect(screen.queryByPlaceholderText("Search notes")).toBeNull();
  });

  it("refuses a view the app does not have, and falls back to the notes", async () => {
    renderAt("/?view=cosmos");
    // The pane the address asked for does not exist, so the notes view is what opens - never a
    // blank shell and never a half-recognised pane.
    expect(await screen.findByPlaceholderText("Search notes")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Trash" })).toBeNull();
  });

  it("writes a view change into the address, and the back button takes it back", async () => {
    const router = renderAt("/");
    await screen.findByPlaceholderText("Search notes");
    fireEvent.click(screen.getByRole("tab", { name: "Graph" }));
    expect(router.state.location.search.view).toBe("graph");
    router.history.back();
    await waitFor(() => expect(router.state.location.search.view).toBeUndefined());
    expect(screen.getByPlaceholderText("Search notes")).toBeTruthy();
  });

  it("names the open note in the address, and back unselects it", async () => {
    const router = renderAt("/");
    await screen.findByPlaceholderText("Search notes");
    fireEvent.click(screen.getByRole("button", { name: /Morning walk/ }));
    expect(router.state.location.search.note).toBe("Ideas/morning-walk.md");
    router.history.back();
    await waitFor(() => expect(router.state.location.search.note).toBeUndefined());
  });

  it("opens the note a deep link points at", async () => {
    renderAt("/?note=Inbox%2Fship-the-release.md");
    expect(await screen.findByRole("heading", { level: 2, name: "Ship the release" })).toBeTruthy();
  });
});
