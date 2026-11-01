// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VaultEntry } from "@lumos/shared";
import { NoteList } from "./NoteList";

afterEach(cleanup);

const NOTES: VaultEntry[] = [
  {
    title: "Plan the week",
    folder: "Inbox",
    file: "C:/vault/Inbox/plan-the-week.md",
    name: "plan-the-week.md",
    created: "2026-10-26T08:00:00.000Z",
    tags: [],
    excerpt: "Monday first.",
  },
];

function renderList(overrides: Partial<Parameters<typeof NoteList>[0]> = {}) {
  return render(
    <NoteList
      notes={NOTES}
      selected={null}
      query=""
      onQuery={() => {}}
      onSelect={() => {}}
      tag={null}
      onTag={() => {}}
      tagCounts={[]}
      loading={false}
      width={320}
      onCreate={async () => {
        throw new Error("the sort test never creates a note");
      }}
      composing={false}
      onComposing={() => {}}
      canCreate={false}
      activeFolder="All"
      folders={["Inbox"]}
      {...overrides}
    />,
  );
}

describe("the list's sort control", () => {
  it("is absent when the shell offers no order", () => {
    renderList();

    expect(screen.queryByRole("combobox", { name: "Sort notes" })).toBeNull();
  });

  it("shows the order in use and reports the one chosen", () => {
    const onSort = vi.fn();
    renderList({ sort: "newest", onSort });

    const select = screen.getByRole("combobox", { name: "Sort notes" });
    expect((select as HTMLSelectElement).value).toBe("newest");
    // Every order is offered, so the control cannot describe an order it cannot reach.
    expect(screen.getAllByRole("option")).toHaveLength(3);

    fireEvent.change(select, { target: { value: "title" } });
    expect(onSort).toHaveBeenCalledWith("title");
  });

  it("ignores a value that is not an order", () => {
    const onSort = vi.fn();
    renderList({ sort: "newest", onSort });

    fireEvent.change(screen.getByRole("combobox", { name: "Sort notes" }), {
      target: { value: "by-magic" },
    });

    expect(onSort).not.toHaveBeenCalled();
  });
});
