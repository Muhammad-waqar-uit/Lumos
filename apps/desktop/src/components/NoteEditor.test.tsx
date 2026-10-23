// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Note } from "@lumos/shared";
import { NoteEditor } from "./NoteEditor";

afterEach(cleanup);

const BODY = "# Learn Rust\n\nship a CLI";

function note(content = BODY): Note {
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
    content,
    problems: [],
  };
}

/** Render the editor with a save that succeeds unless a test overrides it. */
function setup(saveNote = (content: string): Promise<Note> => Promise.resolve(note(content))) {
  const onSave = vi.fn(saveNote);
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(<NoteEditor note={note()} onSave={onSave} onSaved={onSaved} onCancel={onCancel} />);
  return { onSave, onSaved, onCancel, body: screen.getByLabelText("Note body") };
}

describe("NoteEditor", () => {
  it("shows the body as it is, and says nothing has changed", () => {
    const { body } = setup();

    expect((body as HTMLTextAreaElement).value).toBe(BODY);
    expect(screen.queryByText("Unsaved changes")).toBeNull();
  });

  it("says the draft is unsaved once it differs, and sends it with Save", async () => {
    const { onSave, onSaved, body } = setup();

    fireEvent.change(body, { target: { value: "# Rewritten\n\nnew plan" } });
    expect(screen.getByText("Unsaved changes")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith("# Rewritten\n\nnew plan");
    expect(onSaved).toHaveBeenCalledWith(note("# Rewritten\n\nnew plan"));
  });

  it("keeps the draft and shows the daemon's own words when the save fails", async () => {
    const { onSave, onSaved, body } = setup(async () => {
      throw new Error("unknown folder");
    });

    fireEvent.change(body, { target: { value: "# Rewritten" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("unknown folder");
    // The typing survives a failed save: that is the one outcome worth protecting.
    expect((body as HTMLTextAreaElement).value).toBe("# Rewritten");
    expect(onSaved).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("saves with Ctrl+S, without waiting for the button", async () => {
    const { onSave, body } = setup();

    fireEvent.change(body, { target: { value: "# Shortcut" } });
    fireEvent.keyDown(body, { key: "s", ctrlKey: true });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("# Shortcut"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  });

  it("saves once while the first save is in flight, and keeps text typed during it", async () => {
    let finish: (saved: Note) => void = () => undefined;
    const { onSave, onSaved, onCancel, body } = setup(
      () =>
        new Promise<Note>((resolve) => {
          finish = resolve;
        }),
    );

    fireEvent.change(body, { target: { value: "# Once" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
    // The editor cannot be dismissed while the answer is still coming.
    fireEvent.keyDown(body, { key: "Escape" });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    // Typing while the request is out is not thrown away when it lands.
    fireEvent.change(body, { target: { value: "# Second" } });
    finish(note("# Once"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeDefined());

    expect(onSaved).not.toHaveBeenCalled();
    expect((body as HTMLTextAreaElement).value).toBe("# Second");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenLastCalledWith("# Second");
  });

  it("shows the draft rendered beside the textarea, and follows the typing", () => {
    const { body } = setup();
    const preview = screen.getByLabelText("Preview");

    // The same renderer the saved note is read with, so a heading here is a heading there.
    expect(within(preview).getByRole("heading", { level: 1 }).textContent).toBe("Learn Rust");

    fireEvent.change(body, { target: { value: "## Rewritten\n\n- one\n- two" } });

    expect(within(preview).getByRole("heading", { level: 2 }).textContent).toBe("Rewritten");
    expect(within(preview).getAllByRole("listitem")).toHaveLength(2);
  });

  it("hides the preview when asked, and says which way the toggle is set", () => {
    const { body } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Hide preview" }));

    expect(screen.queryByLabelText("Preview")).toBeNull();
    expect(screen.getByRole("button", { name: "Preview" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    // The draft is not the preview's: hiding the pane leaves the text exactly as it was.
    expect((body as HTMLTextAreaElement).value).toBe(BODY);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByLabelText("Preview")).toBeDefined();
  });

  it("says an empty draft has nothing to preview instead of showing a blank pane", () => {
    const { body } = setup();

    fireEvent.change(body, { target: { value: "   " } });

    expect(screen.getByLabelText("Preview").textContent).toBe("Nothing to preview yet.");
  });

  it("throws the draft away with Escape or with Cancel, and saves nothing", () => {
    const { onCancel, onSave, body } = setup();

    fireEvent.change(body, { target: { value: "# Never mind" } });
    fireEvent.keyDown(body, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onSave).not.toHaveBeenCalled();
  });
});
