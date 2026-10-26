// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FOLDERS, type Folder, type Note, type VaultEntry } from "@lumos/shared";
import { NoteList } from "./NoteList";

afterEach(cleanup);

function entry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    title: "build a habit tracker",
    folder: "Ideas" as Folder,
    file: "/vault/Ideas/2026-10-20-build-a-habit-tracker.md",
    name: "2026-10-20-build-a-habit-tracker.md",
    created: "2026-10-20",
    tags: ["ideas"],
    excerpt: "track two habits",
    ...overrides,
  };
}

function renderList(overrides: Partial<Parameters<typeof NoteList>[0]> = {}): void {
  render(
    <NoteList
      notes={[entry()]}
      selected={null}
      query=""
      onQuery={() => {}}
      onSelect={() => {}}
      tag={null}
      onTag={() => {}}
      tagCounts={[{ tag: "ideas", count: 1 }]}
      loading={false}
      width={320}
      onCreate={async () => madeNote()}
      composing={false}
      onComposing={() => {}}
      canCreate={true}
      activeFolder="All"
      folders={DEFAULT_FOLDERS}
      {...overrides}
    />,
  );
}

/** A note as the daemon would answer a create: whatever the test needs it to say. */
function madeNote(overrides: Partial<Note> = {}): Note {
  return {
    title: "New note",
    folder: "Inbox",
    file: "/vault/Inbox/2026-10-20-new-note.md",
    frontmatter: {
      source: "desktop",
      created: "2026-10-20T09:00:00.000Z",
      tags: [],
      status: "new",
    },
    content: "# New note",
    problems: [],
    ...overrides,
  };
}

describe("NoteList - states", () => {
  it("says it is loading instead of showing an empty vault", () => {
    renderList({ loading: true, notes: [] });

    expect(screen.getByText("Loading…")).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("says the folder is empty when no tag narrows it", () => {
    renderList({ notes: [] });
    expect(screen.getByText("No notes here yet.")).toBeDefined();
  });

  it("names the tag when a filter is what emptied the list", () => {
    renderList({ notes: [], tag: "rust" });
    expect(screen.getByText("No notes tagged #rust.")).toBeDefined();
  });
});

describe("NoteList - a large vault", () => {
  it("puts a window of rows in the DOM, not the whole vault", () => {
    // jsdom gives every element a zero-height box, and a window over nothing is nothing: the
    // virtualizer reads the scroll container's clientHeight (its size) and each row's offsetHeight
    // (its measurement), so both are told a plausible size - all the virtualizer was ever asked.
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("overflow-y-auto") ? 600 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return 100;
      },
    });
    const many = Array.from({ length: 60 }, (_, i) =>
      entry({ title: `note ${i}`, name: `2026-10-20-note-${i}.md` }),
    );
    renderList({ notes: many });

    // The list is the one part of the shell that has to scale: every row in the DOM is a row
    // React re-renders on every keystroke of the search above them.
    const rows = screen.getAllByRole("listitem");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(60);
    expect(screen.getByText("note 0")).toBeDefined();
    Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
  });

  it("renders every row while the vault is small enough to just show", () => {
    renderList({
      notes: [entry({ title: "one" }), entry({ title: "two" }), entry({ title: "three" })],
    });
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("NoteList - rows", () => {
  it("shows the title, folder and tags, and opens the note that was clicked", () => {
    const onSelect = vi.fn();
    renderList({ onSelect });

    expect(screen.getByText("build a habit tracker")).toBeDefined();
    expect(screen.getByText("track two habits")).toBeDefined();
    expect(screen.getByText("Ideas")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /build a habit tracker/ }));
    expect(onSelect).toHaveBeenCalledWith("Ideas/2026-10-20-build-a-habit-tracker.md");
  });

  it("marks the open note, and only it", () => {
    renderList({
      notes: [entry(), entry({ title: "learn rust", name: "2026-10-21-learn-rust.md" })],
      selected: "Ideas/2026-10-21-learn-rust.md",
    });

    expect(screen.getByRole("button", { name: /learn rust/ }).getAttribute("aria-current")).toBe(
      "true",
    );
    expect(
      screen.getByRole("button", { name: /build a habit tracker/ }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("flags a note whose frontmatter is broken, with the reasons in the title", () => {
    renderList({ notes: [entry({ problems: ["created is not a date", "tags is not a list"] })] });

    const badge = screen.getByText("! frontmatter");
    expect(badge.getAttribute("title")).toBe("created is not a date; tags is not a list");
  });

  it("says nothing about a note that is fine", () => {
    renderList();
    expect(screen.queryByText("! frontmatter")).toBeNull();
  });

  it("passes the query up as it is typed", () => {
    const onQuery = vi.fn();
    renderList({ onQuery });

    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "hab" } });
    expect(onQuery).toHaveBeenCalledWith("hab");
  });
});

describe("NoteList - tags", () => {
  it("turns a tag chip on, and the active chip off again", () => {
    const onTag = vi.fn();
    renderList({ onTag });

    const chips = screen.getByRole("group", { name: "Filter by tag" });
    fireEvent.click(within(chips).getByRole("button", { name: /#ideas/ }));
    expect(onTag).toHaveBeenLastCalledWith("ideas");

    cleanup();
    renderList({ onTag, tag: "ideas" });
    fireEvent.click(
      within(screen.getByRole("group", { name: "Filter by tag" })).getByRole("button", {
        name: /#ideas/,
      }),
    );
    expect(onTag).toHaveBeenLastCalledWith(null);
  });

  it("keeps the chip of a tag whose notes are gone, so it can be switched off", () => {
    renderList({ notes: [], tag: "travel", tagCounts: [{ tag: "ideas", count: 1 }] });

    const chips = screen.getByRole("group", { name: "Filter by tag" });
    const buttons = Array.from(chips.querySelectorAll("button"));
    expect(buttons[0].textContent).toBe("#travel");
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("filters by a note's own tag without opening the note", () => {
    const onTag = vi.fn();
    const onSelect = vi.fn();
    renderList({ onTag, onSelect, notes: [entry({ tags: ["ideas", "rust"] })] });

    fireEvent.click(screen.getByRole("button", { name: "#rust" }));

    expect(onTag).toHaveBeenCalledWith("rust");
    expect(onSelect).not.toHaveBeenCalled();
  });
});
