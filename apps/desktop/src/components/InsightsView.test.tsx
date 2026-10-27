// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { GraphData, GraphNode, VaultEntry } from "@lumos/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InsightsView } from "./InsightsView";

afterEach(cleanup);

function entry(folder: string, name: string, created: string, tags: string[] = []): VaultEntry {
  return {
    title: name.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, ""),
    folder,
    file: `${folder}/${name}`,
    name,
    created,
    tags,
    excerpt: "",
  };
}

function note(id: string, inDegree: number, orphan = false): GraphNode {
  return {
    id,
    label: id.split("/").pop()?.replace(/\.md$/, "") ?? id,
    kind: "note",
    folder: id.split("/")[0],
    tags: [],
    inDegree,
    outDegree: 0,
    orphan,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * An ISO timestamp `days` before now. The growth figures are counted against the clock, so a
 * fixture written with fixed dates would start failing the day it stopped being true.
 */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

/** The four-note vault the cases below read: two folders, three tags, seven links. */
const NOTES: VaultEntry[] = [
  entry("Inbox", "2026-10-26-a-note.md", daysAgo(1), ["rust", "goal"]),
  entry("Inbox", "2026-10-20-b-note.md", daysAgo(60), ["rust"]),
  entry("Inbox", "2026-09-01-c-note.md", daysAgo(200), ["goal"]),
  entry("Ideas", "2026-08-01-d-note.md", daysAgo(400), ["idea"]),
];

const GRAPH: GraphData = {
  nodes: [
    note("Goals/learn-rust.md", 5),
    note("Inbox/a-note.md", 2),
    ...Array.from({ length: 6 }, (_, index) => note(`Inbox/orphan-${index}.md`, 0, true)),
    { ...note("#rust", 2), kind: "tag" as const, label: "#rust" },
  ],
  edges: [
    ...Array.from({ length: 7 }, (_, index) => ({
      source: `Inbox/a-note.md`,
      target: `Goals/target-${index}.md`,
      kind: "link" as const,
    })),
    { source: "Inbox/a-note.md", target: "#rust", kind: "tag" as const },
  ],
  unresolved: [
    { source: "Inbox/a-note.md", target: "Someday" },
    { source: "Inbox/b-note.md", target: "Movies/list" },
  ],
};

function renderInsights(overrides: Partial<Parameters<typeof InsightsView>[0]> = {}) {
  const onOpen = vi.fn();
  const onFilterTag = vi.fn();
  render(
    <InsightsView
      notes={NOTES}
      graph={GRAPH}
      connection="daemon"
      loading={false}
      onOpen={onOpen}
      onFilterTag={onFilterTag}
      {...overrides}
    />,
  );
  return { onOpen, onFilterTag };
}

/** The figure beside a label, read out of the panel's own definition list. */
function statValue(label: string): string | undefined {
  const panel = screen.getByRole("region", { name: "Vault insights" });
  const list = panel.querySelector("dl");
  if (!list) return undefined;
  const term = [...list.querySelectorAll("dt")].find((node) => node.textContent === label);
  return term?.parentElement?.querySelector("dd")?.textContent ?? undefined;
}

describe("InsightsView - the figures", () => {
  it("counts notes, folders, tags and links, and says where they came from", () => {
    renderInsights();

    expect(statValue("Notes")).toBe("4");
    expect(statValue("Folders")).toBe("2");
    expect(statValue("Tags")).toBe("3");
    expect(statValue("Links")).toBe("7");
    expect(statValue("This week")).toBe("1");
    expect(statValue("Not linked")).toBe("6");
    expect(screen.getByText(/2 unresolved/)).toBeDefined();
    expect(screen.getByText("Live vault")).toBeDefined();
  });

  it("says the figures come from the demo vault when the daemon is out", () => {
    renderInsights({ connection: "demo" });

    expect(screen.getByText(/Offline — demo vault/)).toBeDefined();
  });

  it("asks nothing of a vault that is still loading", () => {
    renderInsights({ loading: true });

    expect(screen.getByText("Reading the vault…")).toBeDefined();
    expect(screen.queryByText("Notes")).toBeNull();
  });

  it("says the vault is empty instead of drawing an empty panel", () => {
    renderInsights({ notes: [], graph: { nodes: [], edges: [], unresolved: [] } });

    expect(screen.getByText(/The vault is empty/)).toBeDefined();
    expect(screen.queryByText("Most linked")).toBeNull();
  });
});

describe("InsightsView - the lists", () => {
  it("puts a tag node nowhere near the most-linked notes", () => {
    renderInsights();

    const mostLinked = screen.getByText("Most linked").parentElement;
    expect(mostLinked?.textContent).toContain("learn-rust");
    expect(mostLinked?.textContent).not.toContain("#rust");
  });

  it("opens the note a most-linked row names", () => {
    const { onOpen } = renderInsights();

    fireEvent.click(screen.getByRole("button", { name: /learn-rust/ }));

    expect(onOpen).toHaveBeenCalledWith("Goals/learn-rust.md");
  });

  it("filters the list to a tag, without the graph's hash", () => {
    const { onFilterTag } = renderInsights();

    // The count is part of the button's name, and it has to read as two words: "rust2" is what
    // the sighted layout hid before the space was added.
    fireEvent.click(screen.getByRole("button", { name: "rust 2" }));

    expect(onFilterTag).toHaveBeenCalledWith("rust");
  });

  it("counts every orphan but lists only a row's worth", () => {
    renderInsights();

    const section = screen.getByText("Not connected yet").parentElement;
    expect(section?.querySelectorAll("li")).toHaveLength(5);
    expect(section?.textContent).toContain("and 1 more");
  });

  it("says so when nothing is orphaned and when there are no tags", () => {
    renderInsights({
      graph: { nodes: [note("Inbox/a-note.md", 2)], edges: [], unresolved: [] },
      notes: [entry("Inbox", "2026-10-20-a-note.md", daysAgo(2))],
    });

    expect(screen.getByText("Every note is connected.")).toBeDefined();
    expect(screen.getByText(/No tags yet/)).toBeDefined();
  });
});

describe("InsightsView - a graph that could not be read", () => {
  it("leaves the link figures out rather than printing zero, and says why", () => {
    renderInsights({ graph: null });

    expect(statValue("Links")).toBe("—");
    expect(statValue("Not linked")).toBe("—");
    expect(screen.getByRole("status").textContent).toContain("could not be read");
    expect(screen.getAllByText("Not read.")).toHaveLength(2);
    // The figures a listing can answer on its own are still shown.
    expect(statValue("Notes")).toBe("4");
    expect(statValue("Tags")).toBe("3");
  });
});
