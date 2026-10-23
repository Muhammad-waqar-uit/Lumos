// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Note } from "@lumos/shared";
import { NoteMeta } from "./NoteMeta";

afterEach(cleanup);

function note(overrides: Partial<Note["frontmatter"]> = {}): Note {
  return {
    title: "Learn Rust",
    folder: "Ideas",
    file: "/vault/Ideas/2026-10-20-learn-rust.md",
    frontmatter: {
      source: "desktop",
      created: "2026-10-20T00:00:00.000Z",
      tags: ["rust"],
      status: "new",
      ...overrides,
    },
    content: "# Learn Rust\n\nship a CLI",
    problems: [],
  };
}

function setup(overrides: Partial<Parameters<typeof NoteMeta>[0]> = {}) {
  const onTags = vi.fn(overrides.onTags ?? ((): Promise<void> => Promise.resolve()));
  const onStatus = vi.fn(overrides.onStatus ?? ((): Promise<void> => Promise.resolve()));
  render(
    <NoteMeta note={note()} canEdit={true} onTags={onTags} onStatus={onStatus} {...overrides} />,
  );
  return { onTags, onStatus };
}

describe("NoteMeta", () => {
  it("shows each tag, and sends the list without the one that was removed", async () => {
    const { onTags } = setup();

    expect(screen.getByText("#rust")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Remove tag rust" }));

    await waitFor(() => expect(onTags).toHaveBeenCalledWith([]));
  });

  it("adds a tag as the vault writes it, and clears the field", async () => {
    const { onTags } = setup();
    const field = screen.getByRole("textbox", { name: "Add a tag" });

    fireEvent.change(field, { target: { value: "  #Rust-Tips " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onTags).toHaveBeenCalledWith(["rust", "rust-tips"]));
    await waitFor(() => expect((field as HTMLInputElement).value).toBe(""));
  });

  it("changes the status from the picker", async () => {
    const { onStatus } = setup();

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "done" },
    });

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith("done"));
  });

  it("keeps the reason on screen when a write is refused, and the draft with it", async () => {
    const onTags = vi.fn(() =>
      Promise.reject(new Error("this note's frontmatter is not valid YAML")),
    );
    setup({ onTags });
    const field = screen.getByRole("textbox", { name: "Add a tag" });

    fireEvent.change(field, { target: { value: "later" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "this note's frontmatter is not valid YAML",
    );
    expect((field as HTMLInputElement).value).toBe("later");
  });

  it("is read-only with the daemon down: chips stay, the controls do not", () => {
    setup({ canEdit: false });

    expect(screen.getByText("#rust")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Remove tag rust" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Add a tag" }) as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("combobox", { name: "Status" }) as HTMLSelectElement).disabled).toBe(
      true,
    );
  });
});
