// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { VaultEntry } from "@lumos/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TagsView } from "./TagsView";

afterEach(cleanup);

function entry(folder: string, name: string, tags: string[]): VaultEntry {
  return {
    title: name.replace(/\.md$/, ""),
    folder,
    file: `${folder}/${name}`,
    name,
    created: "2026-10-20T08:00:00.000Z",
    tags,
    excerpt: "",
  };
}

const NOTES: VaultEntry[] = [
  entry("Inbox", "a.md", ["rust", "goal"]),
  entry("Ideas", "b.md", ["rust"]),
  entry("Ideas", "d.md", ["alone"]),
  entry("Inbox", "c.md", []),
];

function renderTags(overrides: Partial<Parameters<typeof TagsView>[0]> = {}) {
  return render(
    <TagsView
      notes={NOTES}
      connection="daemon"
      loading={false}
      onFilterTag={() => {}}
      {...overrides}
    />,
  );
}

describe("TagsView", () => {
  it("counts the tags and the notes that carry none", () => {
    renderTags();

    expect(screen.getByRole("region", { name: "Tags" })).toBeTruthy();
    const text = screen.getByRole("region", { name: "Tags" }).textContent ?? "";
    expect(text).toContain("3 tags in 3 notes");
    expect(text).toContain("1 note has no tags");
  });

  it("lists each tag with its reach, its folders and the tags it keeps company with", () => {
    renderTags();

    expect(screen.getByRole("button", { name: "#rust" })).toBeTruthy();
    expect(screen.getByText("in Ideas, Inbox")).toBeTruthy();
    // `rust` and `goal` share one note, so each names the other.
    expect(screen.getByRole("button", { name: "#goal 1" })).toBeTruthy();
  });

  it("opens the notes a tag names", () => {
    const onFilterTag = vi.fn();
    renderTags({ onFilterTag });

    fireEvent.click(screen.getByRole("button", { name: "#rust" }));

    expect(onFilterTag).toHaveBeenCalledWith("rust");
  });

  it("narrows the list by name and by a folder's tags", () => {
    renderTags();
    const field = screen.getByLabelText("Filter tags");

    fireEvent.change(field, { target: { value: "alone" } });
    expect(screen.queryByRole("button", { name: "#rust" })).toBeNull();
    expect(screen.getByRole("button", { name: "#alone" })).toBeTruthy();

    // A folder names the tags filed there, which is how a person finds a tag they cannot recall.
    fireEvent.change(field, { target: { value: "ideas" } });
    expect(screen.getByRole("button", { name: "#rust" })).toBeTruthy();
    // The `#goal 1` chip is a neighbour inside the rust row, not the goal tag's own row.
    expect(screen.queryByRole("button", { name: "#goal" })).toBeNull();
  });

  it("finds a tag by the one that keeps it company", () => {
    renderTags();

    // `goal` only appears beside `rust` in one note, and asking for it should find that pair.
    fireEvent.change(screen.getByLabelText("Filter tags"), { target: { value: "goal" } });
    expect(screen.getByRole("button", { name: "#rust" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "#goal" })).toBeTruthy();
  });

  it("says when nothing matches the filter", () => {
    renderTags();

    fireEvent.change(screen.getByLabelText("Filter tags"), { target: { value: "zzz" } });

    expect(screen.getByText("No tags match “zzz”.")).toBeTruthy();
  });

  it("says a vault with no tags has none rather than showing an empty list", () => {
    renderTags({ notes: [entry("Inbox", "a.md", [])] });

    expect(screen.getByText(/No tags yet/)).toBeTruthy();
  });

  it("says the vault is empty, and is quiet while it loads", () => {
    const { unmount } = renderTags({ notes: [] });
    expect(screen.getByText(/The vault is empty/)).toBeTruthy();
    unmount();

    renderTags({ loading: true });
    expect(screen.getByText("Reading the vault…")).toBeTruthy();
  });

  it("names the demo vault while the daemon is away", () => {
    renderTags({ connection: "demo" });

    expect(screen.getByText("Offline — demo vault")).toBeTruthy();
  });
});
