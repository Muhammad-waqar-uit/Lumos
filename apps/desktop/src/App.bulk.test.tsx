// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import type { GraphData, Note, VaultEntry } from "@lumos/shared";
import { createAppRouter } from "./router";
import { useVaultStore } from "./lib/store";

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
      folder: "Inbox",
      file: "C:/vault/Inbox/morning-walk.md",
      name: "morning-walk.md",
      created: "2026-10-19T08:00:00.000Z",
      tags: ["health"],
      excerpt: "Routes to try.",
    },
    {
      title: "Reading list",
      folder: "Inbox",
      file: "C:/vault/Inbox/reading-list.md",
      name: "reading-list.md",
      created: "2026-10-18T08:00:00.000Z",
      tags: [],
      excerpt: "Books to find.",
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

const { getFolders, getNotes, getGraph, getNote, moveNote, updateNoteMeta } = vi.hoisted(() => ({
  getFolders: vi.fn(),
  getNotes: vi.fn(),
  getGraph: vi.fn(),
  getNote: vi.fn(),
  moveNote: vi.fn(),
  updateNoteMeta: vi.fn(),
}));

vi.mock("./lib/api", () => ({
  getFolders,
  getNotes,
  getGraph,
  getNote,
  moveNote,
  updateNoteMeta,
  getTrash: vi.fn(async () => []),
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  renameNote: vi.fn(),
  restoreNote: vi.fn(),
  emptyTrash: vi.fn(),
  saveNote: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // The picker offers the folders the vault has, so a move needs a destination in this list.
  getFolders.mockResolvedValue([
    { folder: "Inbox", count: 3 },
    { folder: "Goals", count: 0 },
  ]);
  getNotes.mockResolvedValue(fixtures.notes);
  getGraph.mockResolvedValue({ nodes: [], edges: [], unresolved: [] } satisfies GraphData);
  getNote.mockResolvedValue(fixtures.note);
  moveNote.mockImplementation(async (folder: string, name: string) => ({
    ...fixtures.note,
    folder,
    name,
  }));
  updateNoteMeta.mockResolvedValue(fixtures.note);
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

afterEach(cleanup);

function renderApp() {
  const router = createAppRouter(createMemoryHistory({ initialEntries: ["/"] }));
  render(<RouterProvider router={router} />);
  return router;
}

describe("bulk actions", () => {
  it("archives exactly the selected notes, and says so", async () => {
    renderApp();
    await screen.findByPlaceholderText("Search notes");

    fireEvent.click(screen.getByLabelText("Select Ship the release"));
    fireEvent.click(screen.getByLabelText("Select Reading list"));
    expect(screen.getByText("2 selected")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(await screen.findByText("Archived 2 notes.")).toBeTruthy();
    expect(updateNoteMeta).toHaveBeenCalledTimes(2);
    expect(updateNoteMeta).toHaveBeenCalledWith("Inbox", "ship-the-release.md", {
      status: "archived",
    });
    expect(updateNoteMeta).toHaveBeenCalledWith("Inbox", "reading-list.md", {
      status: "archived",
    });
    // The selection is spent, so the bar is gone with the notice that reports it.
    expect(screen.queryByText("2 selected")).toBeNull();
  });

  it("moves the selection through the folder picker", async () => {
    renderApp();
    await screen.findByPlaceholderText("Search notes");

    fireEvent.click(screen.getByLabelText("Select Morning walk"));
    fireEvent.change(screen.getByLabelText("Move selected notes to"), {
      target: { value: "Goals" },
    });

    expect(await screen.findByText("Moved 1 note.")).toBeTruthy();
    expect(moveNote).toHaveBeenCalledWith("Inbox", "morning-walk.md", "Goals");
  });

  it("keeps going past a refusal and carries the daemon's sentence", async () => {
    renderApp();
    await screen.findByPlaceholderText("Search notes");

    fireEvent.click(screen.getByLabelText("Select Ship the release"));
    fireEvent.click(screen.getByLabelText("Select Morning walk"));
    updateNoteMeta.mockImplementation(async (_folder: string, name: string) => {
      if (name === "morning-walk.md") throw new Error("That name is already taken.");
      return fixtures.note;
    });

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(
      await screen.findByText('Archived 1 of 2; "morning-walk.md": That name is already taken.'),
    ).toBeTruthy();
  });
});
