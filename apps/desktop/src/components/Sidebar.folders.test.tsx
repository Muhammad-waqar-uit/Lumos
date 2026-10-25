// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "@lumos/shared";
import { Sidebar } from "./Sidebar";

afterEach(cleanup);

const FOLDERS = [
  { folder: "Ideas" as Folder, count: 2 },
  { folder: "Goals" as Folder, count: 1 },
];

/** A sidebar that has a daemon behind it, looking at `active`. */
function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  return render(
    <Sidebar
      folders={FOLDERS}
      total={3}
      active="Ideas"
      onSelect={() => {}}
      view="notes"
      onView={() => {}}
      onRenameFolder={vi.fn(async (): Promise<void> => {})}
      onRemoveFolder={vi.fn(async (): Promise<void> => {})}
      {...overrides}
    />,
  );
}

describe("Sidebar - renaming a folder", () => {
  it("offers no controls while the whole vault is showing, because that is not a folder", () => {
    renderSidebar({ active: "All" });

    // "All notes" is a view over the vault; there is no directory behind it to rename or remove.
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("offers no controls while there is no daemon to ask", () => {
    renderSidebar({ onRenameFolder: undefined, onRemoveFolder: undefined });

    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("starts the form with the folder's own name, so a typo needs a second edit", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    // The field is prefilled and selected-ready: renaming to a similar name is the common case.
    expect(screen.getByLabelText("New folder name")).toHaveProperty("value", "Ideas");
  });

  it("renames the folder it is looking at, and closes the form", async () => {
    const onRenameFolder = vi.fn(async (): Promise<void> => {});
    renderSidebar({ onRenameFolder });

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("New folder name"), { target: { value: "Film" } });
    // The form's own button, which is labelled for the action it will take rather than for
    // opening the form - so it cannot be confused with the control that opened it.
    fireEvent.click(screen.getByRole("button", { name: "Rename folder" }));

    await waitFor(() => expect(onRenameFolder).toHaveBeenCalledWith("Ideas", "Film"));
    // The form closes itself once the rename landed.
    expect(screen.queryByLabelText("New folder name")).toBeNull();
  });

  it("renames on Enter as well as on the button", async () => {
    const onRenameFolder = vi.fn(async (): Promise<void> => {});
    renderSidebar({ onRenameFolder });

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("New folder name"), { target: { value: "Film" } });
    fireEvent.submit(screen.getByLabelText("New folder name"));

    await waitFor(() => expect(onRenameFolder).toHaveBeenCalledWith("Ideas", "Film"));
  });

  it("keeps the form open with the daemon's reason when the name is taken", async () => {
    const onRenameFolder = vi.fn(async (): Promise<void> => {
      throw new Error("A folder called Goals is already there.");
    });
    renderSidebar({ onRenameFolder });

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("New folder name"), { target: { value: "Goals" } });
    // The form's own button, which is labelled for the action it will take rather than for
    // opening the form - so it cannot be confused with the control that opened it.
    fireEvent.click(screen.getByRole("button", { name: "Rename folder" }));

    expect(await screen.findByText("A folder called Goals is already there.")).toBeTruthy();
    // The person can correct the name without starting over.
    expect(screen.getByLabelText("New folder name")).toHaveProperty("value", "Goals");
    expect(onRenameFolder).toHaveBeenCalledTimes(1);
  });

  it("will not send an empty name, and closes on Escape", () => {
    const onRenameFolder = vi.fn(async (): Promise<void> => {});
    renderSidebar({ onRenameFolder });

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("New folder name"), { target: { value: "   " } });
    // The form's own button, which is labelled for the action it will take rather than for
    // opening the form - so it cannot be confused with the control that opened it.
    fireEvent.click(screen.getByRole("button", { name: "Rename folder" }));
    expect(onRenameFolder).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByLabelText("New folder name"), { key: "Escape" });
    expect(screen.queryByLabelText("New folder name")).toBeNull();
  });

  it("forgets the previous reason when the form is reopened", async () => {
    const onRenameFolder = vi.fn(async (): Promise<void> => {
      throw new Error("A folder called Goals is already there.");
    });
    renderSidebar({ onRenameFolder });

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    // The form's own button, which is labelled for the action it will take rather than for
    // opening the form - so it cannot be confused with the control that opened it.
    fireEvent.click(screen.getByRole("button", { name: "Rename folder" }));
    await screen.findByText("A folder called Goals is already there.");

    fireEvent.keyDown(screen.getByLabelText("New folder name"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(screen.queryByText("A folder called Goals is already there.")).toBeNull();
  });
});

describe("Sidebar - removing a folder", () => {
  it("asks first, and says what will happen to the notes inside", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    // The folder's name is wrapped in its own span, so the question is matched on the whole
    // paragraph rather than on one text node. It names the folder and the consequence, so
    // removing is a decision rather than a click.
    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName.toLowerCase() === "p" &&
          (element.textContent ?? "").replace(/\s+/g, " ").trim() ===
            "Remove Ideas? Its notes move to Inbox.",
      ),
    ).toBeTruthy();
  });

  it('says "its note" for a folder holding exactly one', () => {
    renderSidebar({ active: "Goals" });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByText(/Its note moves to Inbox\./)).toBeTruthy();
  });

  it("removes the folder only once the question is confirmed", async () => {
    const onRemoveFolder = vi.fn(async (): Promise<void> => {});
    renderSidebar({ onRemoveFolder });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    // Asking is not removing: nothing happens until the question is answered.
    expect(onRemoveFolder).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(onRemoveFolder).toHaveBeenCalledWith("Ideas"));
    expect(screen.queryByText(/Remove/)).toBeNull();
  });

  it("keeps the question on screen with the daemon's reason when it is refused", async () => {
    const onRemoveFolder = vi.fn(async (): Promise<void> => {
      throw new Error("Inbox already has a note called 2026-01-02-a.md.");
    });
    renderSidebar({ onRemoveFolder });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(
      await screen.findByText("Inbox already has a note called 2026-01-02-a.md."),
    ).toBeTruthy();
    // The question stays, so the person can try again once the clash is dealt with.
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy();
    expect(onRemoveFolder).toHaveBeenCalledTimes(1);
  });

  it("cancels without asking the daemon at all", () => {
    const onRemoveFolder = vi.fn(async (): Promise<void> => {});
    renderSidebar({ onRemoveFolder });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onRemoveFolder).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("switches from renaming to removing and back without leaving one open over the other", () => {
    renderSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();

    fireEvent.keyDown(screen.getByLabelText("New folder name"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
  });
});
