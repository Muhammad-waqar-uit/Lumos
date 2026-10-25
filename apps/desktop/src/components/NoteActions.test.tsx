// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FOLDERS, type Note } from "@lumos/shared";
import { NoteActions } from "./NoteActions";

afterEach(cleanup);

function note(overrides: Partial<Note> = {}): Note {
  return {
    title: "Learn Rust",
    folder: "Goals",
    file: "/vault/Goals/2026-10-20-learn-rust.md",
    frontmatter: {
      source: "desktop",
      created: "2026-10-20T09:00:00.000Z",
      tags: ["rust"],
      status: "new",
    },
    content: "# Learn Rust\n\nship a CLI",
    problems: [],
    ...overrides,
  };
}

/** Render the panel with operations that succeed unless a test overrides one. */
function setup(
  overrides: {
    rename?: (title: string) => Promise<void>;
    move?: (folder: string) => Promise<void>;
    remove?: () => Promise<void>;
    linkedFrom?: number;
    folders?: readonly string[];
  } = {},
) {
  const onRename = vi.fn(overrides.rename ?? ((): Promise<void> => Promise.resolve()));
  const onMove = vi.fn(overrides.move ?? ((): Promise<void> => Promise.resolve()));
  const onDelete = vi.fn(overrides.remove ?? ((): Promise<void> => Promise.resolve()));
  const onClose = vi.fn();
  render(
    <NoteActions
      note={note()}
      linkedFrom={overrides.linkedFrom ?? 0}
      folders={overrides.folders ?? DEFAULT_FOLDERS}
      onRename={onRename}
      onMove={onMove}
      onDelete={onDelete}
      onClose={onClose}
    />,
  );
  return { onRename, onMove, onDelete, onClose };
}

describe("NoteActions - the menu", () => {
  it("offers the file operations the app can make", () => {
    setup();

    expect(screen.getByRole("button", { name: "Rename" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Move" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
    // Nothing has been picked, so nothing is being asked about yet.
    expect(screen.queryByLabelText("New title")).toBeNull();
  });

  it("goes back to the menu with Cancel, and sends nothing", () => {
    const { onRename, onDelete, onClose } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Rename" })).toBeDefined();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onRename).not.toHaveBeenCalled();
  });
});

describe("NoteActions - rename", () => {
  it("starts from the title the note already has, and sends what was typed", async () => {
    const { onRename, onClose } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByLabelText("New title") as HTMLInputElement;
    expect(input.value).toBe("Learn Rust");

    fireEvent.change(input, { target: { value: "Learn Rust properly" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => expect(onRename).toHaveBeenCalledWith("Learn Rust properly"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the panel open and shows the daemon's own words when the rename is refused", async () => {
    const { onRename, onClose } = setup({
      rename: () => Promise.reject(new Error("a note with that name already exists")),
    });

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("a note with that name already exists");
    // A refusal is something to act on, so the panel stays where the person can read it.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText("New title")).toBeDefined();
    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it("says when other notes point here, and that their links follow", () => {
    setup({ linkedFrom: 2 });

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(screen.getByText(/2 notes link here; their links are rewritten too/)).toBeDefined();
  });

  it("says nothing about links when no note points here", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(screen.queryByText(/links are rewritten too/)).toBeNull();
  });

  it("cannot send twice while the first rename is in flight", async () => {
    let finish: () => void = () => undefined;
    const { onRename, onClose } = setup({
      rename: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    // Pressing again while the answer is out is not a second rename.
    fireEvent.click(screen.getByRole("button", { name: "Renaming…" }));

    expect(onRename).toHaveBeenCalledTimes(1);
    finish();
    // The panel closes once the rename has landed, and not before.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe("NoteActions - move", () => {
  it("offers every folder but the one it is already in, and moves into the one picked", async () => {
    const { onMove } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    const select = screen.getByLabelText("Move to") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      "Inbox",
      "Ideas",
      "Interviews",
      "Reading",
    ]);

    fireEvent.change(select, { target: { value: "Reading" } });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => expect(onMove).toHaveBeenCalledWith("Reading"));
  });

  it("offers a folder made after the first render", async () => {
    // The folders come from the vault, so one made a moment ago is already a destination.
    const { onMove } = setup({ folders: [...DEFAULT_FOLDERS, "Movies"] });

    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    const select = screen.getByLabelText("Move to") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "Movies" } });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => expect(onMove).toHaveBeenCalledWith("Movies"));
  });
});

describe("NoteActions - delete", () => {
  it("asks before deleting, and sends nothing until the question is answered", async () => {
    const { onDelete, onClose } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    // The first press is a question, not the delete.
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/moves to the vault’s trash/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the question open when the delete fails", async () => {
    const { onDelete, onClose } = setup({
      remove: () => Promise.reject(new Error("note not found")),
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect((await screen.findByRole("alert")).textContent).toBe("note not found");
    expect(onClose).not.toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
