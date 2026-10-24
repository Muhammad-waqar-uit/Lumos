// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note } from "@lumos/shared";
import { NoteViewer } from "./NoteViewer";

const note: Note = {
  title: "Snippet",
  folder: "Reading",
  file: "/vault/Reading/Snippet.md",
  frontmatter: {
    source: "desktop",
    created: "2026-10-20T09:00:00.000Z",
    tags: [],
    status: "new",
  },
  content: "body",
  problems: [],
};

function renderViewer(): void {
  render(
    <NoteViewer
      note={note}
      connection="daemon"
      backlinks={[]}
      onOpenNote={() => {}}
      onSave={async (content) => ({ ...note, content })}
      onRename={async () => {}}
      onMove={async () => {}}
      onDelete={async () => {}}
      onTags={async () => {}}
      onStatus={async () => {}}
    />,
  );
}

/** Everything React tried to say through console.error while the test ran. */
let said: unknown[][] = [];

beforeEach(() => {
  said = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    said.push(args);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

/** React's own words when two siblings in one list claim the same key. */
function duplicateKeyWarnings(): unknown[][] {
  return said.filter((args) =>
    args.some((arg) => typeof arg === "string" && arg.includes("same key")),
  );
}

describe("NoteViewer child keys", () => {
  it("says nothing about keys while the note is only being read", () => {
    renderViewer();
    expect(duplicateKeyWarnings()).toEqual([]);
  });

  it("keeps its keys distinct while the editor is open", () => {
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    // The editor really mounted beside the tag strip - that pairing is what collided.
    expect(screen.getByLabelText("Note body")).toBeDefined();
    expect(duplicateKeyWarnings()).toEqual([]);
  });

  it("keeps its keys distinct while the actions panel is open", () => {
    renderViewer();
    fireEvent.click(screen.getByRole("button", { name: "Note actions" }));

    expect(screen.getByLabelText("File operations")).toBeDefined();
    expect(duplicateKeyWarnings()).toEqual([]);
  });
});
