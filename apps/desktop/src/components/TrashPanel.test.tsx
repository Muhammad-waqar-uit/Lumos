// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrashedNote } from "../lib/api";
import { TrashPanel } from "./TrashPanel";

afterEach(cleanup);

function entry(overrides: Partial<TrashedNote> = {}): TrashedNote {
  return {
    id: "2026-10-22T10-00-00-000Z",
    name: "learn-rust.md",
    folder: "Goals",
    deleted: "2026-10-22T10:00:00.000Z",
    ...overrides,
  };
}

/** Render the panel with reads and writes that succeed unless a test overrides one. */
function setup(
  overrides: {
    load?: () => Promise<TrashedNote[]>;
    restore?: (id: string, name: string) => Promise<void>;
    empty?: () => Promise<void>;
  } = {},
) {
  const onLoad = vi.fn(
    overrides.load ?? ((): Promise<TrashedNote[]> => Promise.resolve([entry()])),
  );
  const onRestore = vi.fn(overrides.restore ?? ((): Promise<void> => Promise.resolve()));
  const onEmpty = vi.fn(overrides.empty ?? ((): Promise<void> => Promise.resolve()));
  const onClose = vi.fn();
  render(<TrashPanel onLoad={onLoad} onRestore={onRestore} onEmpty={onEmpty} onClose={onClose} />);
  return { onLoad, onRestore, onEmpty, onClose };
}

describe("TrashPanel - the list", () => {
  it("reads the trash once and shows each note without its extension", async () => {
    const { onLoad } = setup({
      load: (): Promise<TrashedNote[]> =>
        Promise.resolve([
          entry(),
          entry({ id: "2026-10-21T09-00-00-000Z", name: "morning-walk.md", folder: "Journal" }),
        ]),
    });

    await waitFor(() => expect(screen.getByText("learn-rust")).toBeDefined());
    expect(screen.getByText("morning-walk")).toBeDefined();
    expect(screen.getByText(/Goals · deleted/)).toBeDefined();
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it("says so when the trash is empty", async () => {
    setup({ load: (): Promise<TrashedNote[]> => Promise.resolve([]) });

    await waitFor(() => expect(screen.getByText("The trash is empty.")).toBeDefined());
  });

  it("shows the daemon's sentence when the read fails, and lists nothing", async () => {
    setup({
      load: (): Promise<TrashedNote[]> => Promise.reject(new Error("The vault is not readable.")),
    });

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("The vault is not readable."),
    );
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
  });
});

describe("TrashPanel - restoring", () => {
  it("sends the entry's id and name, then drops it from the list", async () => {
    const { onRestore } = setup();

    await waitFor(() => expect(screen.getByText("learn-rust")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() => expect(screen.queryByText("learn-rust")).toBeNull());
    expect(onRestore).toHaveBeenCalledWith("2026-10-22T10-00-00-000Z", "learn-rust.md");
  });

  it("keeps the entry and shows the reason when the restore is refused", async () => {
    setup({
      restore: (): Promise<void> => Promise.reject(new Error("learn-rust.md already exists.")),
    });

    await waitFor(() => expect(screen.getByText("learn-rust")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("learn-rust.md already exists."),
    );
    // The entry is still there: the person can rename the clashing note and try again.
    expect(screen.getByText("learn-rust")).toBeDefined();
  });
});

describe("TrashPanel - emptying", () => {
  it("asks before it sends, and sends nothing while unconfirmed", async () => {
    const { onEmpty } = setup();

    await waitFor(() => expect(screen.getByText("learn-rust")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Empty the trash" }));

    // Two presses: the button named the action, then the one that names the cost.
    expect(screen.getByRole("button", { name: "Yes, remove them" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Keep them" })).toBeDefined();
    expect(onEmpty).not.toHaveBeenCalled();
  });

  it("sends nothing when the second thought wins", async () => {
    const { onEmpty } = setup();

    await waitFor(() => expect(screen.getByText("learn-rust")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Empty the trash" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep them" }));

    expect(screen.getByRole("button", { name: "Empty the trash" })).toBeDefined();
    expect(onEmpty).not.toHaveBeenCalled();
  });

  it("empties, then closes: an empty list is not worth a pane", async () => {
    const { onEmpty, onClose } = setup();

    await waitFor(() => expect(screen.getByText("learn-rust")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Empty the trash" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove them" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onEmpty).toHaveBeenCalledTimes(1);
  });

  it("stays open with the reason when the daemon refuses the empty", async () => {
    const { onEmpty, onClose } = setup({
      empty: (): Promise<void> => Promise.reject(new Error("The vault is not writable.")),
    });

    await waitFor(() => expect(screen.getByText("learn-rust")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Empty the trash" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove them" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("The vault is not writable."),
    );
    // The press was sent, the daemon refused it, and the panel stayed rather than closing on a failure.
    expect(onEmpty).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    // The list is untouched, so the confirmation is not lost behind a silent close.
    expect(screen.getByText("learn-rust")).toBeDefined();
  });
});

describe("TrashPanel - leaving", () => {
  it("closes from the header without touching the trash", async () => {
    const { onClose } = setup();

    await waitFor(() => expect(screen.getByText("learn-rust")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
