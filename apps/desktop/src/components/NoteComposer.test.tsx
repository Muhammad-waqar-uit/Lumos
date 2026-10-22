// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Folder, Note } from "@lumos/shared";
import { NoteComposer } from "./NoteComposer";

afterEach(cleanup);

function note(folder: Folder = "Inbox"): Note {
  return {
    title: "Book the flights",
    folder,
    file: `/vault/${folder}/2026-10-20-book-the-flights.md`,
    frontmatter: {
      source: "desktop",
      created: "2026-10-20T09:00:00.000Z",
      tags: [],
      status: "new",
    },
    content: "# Book the flights",
    problems: [],
  };
}

/** Render the composer with a create that succeeds unless a test overrides it. */
function setup(
  onCreate = (folder: Folder, _text: string): Promise<Note> => Promise.resolve(note(folder)),
) {
  const create = vi.fn(onCreate);
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(
    <NoteComposer
      initialFolder="Inbox"
      onCreate={create}
      onCreated={onCreated}
      onCancel={onCancel}
    />,
  );
  return {
    create,
    onCreated,
    onCancel,
    text: screen.getByLabelText("Note") as HTMLTextAreaElement,
    folder: screen.getByLabelText("Folder") as HTMLSelectElement,
  };
}

describe("NoteComposer", () => {
  it("starts empty, in the folder it was given", () => {
    const { text, folder } = setup();

    expect(text.value).toBe("");
    expect(folder.value).toBe("Inbox");
    // Nothing has been typed, so there is nothing to file and nothing to warn about.
    expect(screen.getByRole("button", { name: "Create" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("Unsaved")).toBeNull();
  });

  it("offers every vault folder", () => {
    const { folder } = setup();

    expect(Array.from(folder.options).map((option) => option.value)).toEqual([
      "Inbox",
      "Ideas",
      "Interviews",
      "Goals",
      "Reading",
    ]);
  });

  it("files what was typed into the folder chosen, and says so", async () => {
    const { create, onCreated, text, folder } = setup();

    fireEvent.change(text, { target: { value: "Book the flights #travel" } });
    expect(screen.getByText("Unsaved")).toBeDefined();

    fireEvent.change(folder, { target: { value: "Goals" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith("Goals", "Book the flights #travel");
    expect(onCreated).toHaveBeenCalledWith(note("Goals"));
  });

  it("keeps the draft and shows the daemon's own words when the create fails", async () => {
    const { create, onCreated, text } = setup(async () => {
      throw new Error("unknown folder");
    });

    fireEvent.change(text, { target: { value: "Book the flights" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("unknown folder");
    // The typing survives a refused create - the one promise this form has to keep.
    expect((screen.getByLabelText("Note") as HTMLTextAreaElement).value).toBe("Book the flights");
    expect(onCreated).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("files with Ctrl+Enter", async () => {
    const { create, text } = setup();

    fireEvent.change(text, { target: { value: "Keyboard filed this" } });
    fireEvent.keyDown(text, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(create).toHaveBeenCalledWith("Inbox", "Keyboard filed this"));
  });

  it("keeps a plain Enter as a newline rather than filing early", async () => {
    const { create, text } = setup();

    fireEvent.change(text, { target: { value: "first line" } });
    fireEvent.keyDown(text, { key: "Enter" });

    expect(create).not.toHaveBeenCalled();
  });

  it("cannot be filed twice while the first create is in flight", async () => {
    let finish: (created: Note) => void = () => undefined;
    const { create, text } = setup(
      () =>
        new Promise<Note>((resolve) => {
          finish = resolve;
        }),
    );

    fireEvent.change(text, { target: { value: "Once" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    fireEvent.click(screen.getByRole("button", { name: "Creating…" }));

    expect(create).toHaveBeenCalledTimes(1);
    finish(note());
    await waitFor(() => expect(screen.getByRole("button", { name: "Create" })).toBeDefined());
  });

  it("closes with Escape or with Cancel, and files nothing", () => {
    const { onCancel, create, text } = setup();

    fireEvent.change(text, { target: { value: "Never mind" } });
    fireEvent.keyDown(text, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(create).not.toHaveBeenCalled();
  });
});
