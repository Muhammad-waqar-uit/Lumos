import type { GraphData, GraphNode, VaultEntry } from "@lumos/shared";
import { describe, expect, it } from "vitest";
import { INSIGHT_ROWS, vaultInsights } from "./insights";

/** A listing entry with everything the count reads, and nothing else to keep the cases short. */
function entry(folder: string, name: string, created = "2026-10-20T09:00:00.000Z"): VaultEntry {
  return {
    title: name.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, ""),
    folder,
    file: `${folder}/${name}`,
    name,
    created,
    tags: [],
    excerpt: "",
  };
}

/** A note node, with the degree and orphan flag the graph would have computed. */
function node(
  id: string,
  inDegree = 0,
  options: { orphan?: boolean; outDegree?: number } = {},
): GraphNode {
  const label = id.split("/").pop()?.replace(/\.md$/, "") ?? id;
  return {
    id,
    label,
    kind: "note",
    folder: id.split("/")[0],
    tags: [],
    inDegree,
    outDegree: options.outDegree ?? 0,
    orphan: options.orphan ?? false,
  };
}

function graphOf(nodes: GraphNode[], edgeCount = 0, unresolved: string[] = []): GraphData {
  return {
    nodes,
    edges: [
      ...Array.from({ length: edgeCount }, (_, index) => ({
        source: `A/a${index}.md`,
        target: `B/b${index}.md`,
        kind: "link" as const,
      })),
      // A tag edge is a relationship, not a link: it must not be counted as one.
      { source: "A/a.md", target: "#rust", kind: "tag" as const },
    ],
    unresolved: unresolved.map((target, index) => ({ source: `A/a${index}.md`, target })),
  };
}

const NOW = new Date("2026-10-27T12:00:00.000Z");

describe("vaultInsights - what is in the vault", () => {
  it("counts notes, folders and distinct tags from the listing alone", () => {
    const notes = [
      { ...entry("Inbox", "2026-10-20-a.md"), tags: ["rust", "goal"] },
      { ...entry("Inbox", "2026-10-21-b.md"), tags: ["rust"] },
      { ...entry("Ideas", "2026-10-22-c.md"), tags: [] },
    ];

    const insights = vaultInsights(notes, null, NOW);

    expect(insights.notes).toBe(3);
    expect(insights.folders).toBe(2);
    expect(insights.tags).toBe(2);
  });

  it("counts a tag once per note however often the note repeats it", () => {
    const notes = [{ ...entry("Inbox", "2026-10-20-a.md"), tags: ["rust", "rust", "goal"] }];

    expect(vaultInsights(notes, null, NOW).topTags).toEqual([
      { id: "#goal", label: "goal", count: 1 },
      { id: "#rust", label: "rust", count: 1 },
    ]);
  });

  it("orders tags and folders by how full they are, then by name", () => {
    const notes = [
      { ...entry("Inbox", "2026-10-20-a.md"), tags: ["rust"] },
      { ...entry("Inbox", "2026-10-20-b.md"), tags: ["rust"] },
      { ...entry("Ideas", "2026-10-20-c.md"), tags: ["goal"] },
      { ...entry("Reading", "2026-10-20-d.md"), tags: ["goal"] },
      { ...entry("Goals", "2026-10-20-e.md"), tags: [] },
    ];

    const insights = vaultInsights(notes, null, NOW);

    expect(insights.topTags.map((tag) => tag.label)).toEqual(["goal", "rust"]);
    // Inbox holds two notes; the single-note folders then come out in name order.
    expect(insights.perFolder.map((folder) => folder.label)).toEqual([
      "Inbox",
      "Goals",
      "Ideas",
      "Reading",
    ]);
  });
});

describe("vaultInsights - the links between notes", () => {
  it("counts resolved links and unresolved ones separately", () => {
    const graph = graphOf([node("A/a.md")], 3, ["A/missing.md", "B/also-missing.md"]);

    const insights = vaultInsights([entry("A", "a.md")], graph, NOW);

    expect(insights.linksKnown).toBe(true);
    expect(insights.links).toBe(3);
    expect(insights.unresolved).toBe(2);
  });

  it("says the link figures are unknown when the graph could not be read", () => {
    const insights = vaultInsights([entry("A", "a.md")], null, NOW);

    expect(insights.linksKnown).toBe(false);
    expect(insights.links).toBe(0);
    expect(insights.unresolved).toBe(0);
    expect(insights.mostLinked).toEqual([]);
    expect(insights.orphans).toEqual([]);
    expect(insights.orphanCount).toBe(0);
  });

  it("lists the notes with the most links pointing in, skipping the ones with none", () => {
    const graph = graphOf([
      node("A/quiet.md", 0),
      node("A/second.md", 2),
      node("A/first.md", 7),
      node("A/third.md", 2),
    ]);

    const insights = vaultInsights([], graph, NOW);

    expect(insights.mostLinked).toEqual([
      { id: "A/first.md", label: "first", count: 7 },
      { id: "A/second.md", label: "second", count: 2 },
      { id: "A/third.md", label: "third", count: 2 },
    ]);
  });

  it("never puts a tag node on the most-linked list", () => {
    const graph = graphOf([
      node("A/a.md", 1),
      { ...node("#rust", 9), kind: "tag" as const, label: "#rust" },
    ]);

    expect(vaultInsights([], graph, NOW).mostLinked.map((row) => row.id)).toEqual(["A/a.md"]);
  });

  it("counts every orphan but shows only a row's worth, alphabetically", () => {
    const nodes = [
      ...Array.from({ length: INSIGHT_ROWS + 2 }, (_, index) =>
        node(`A/note-${index}.md`, 0, { orphan: true }),
      ),
      node("A/linked.md", 3),
    ];

    const insights = vaultInsights([], graphOf(nodes), NOW);

    expect(insights.orphanCount).toBe(INSIGHT_ROWS + 2);
    expect(insights.orphans).toHaveLength(INSIGHT_ROWS);
    expect(insights.orphans.map((row) => row.label)).toEqual([
      "note-0",
      "note-1",
      "note-2",
      "note-3",
      "note-4",
    ]);
  });

  it("shows only a row's worth of tags while counting them all", () => {
    const notes = Array.from({ length: INSIGHT_ROWS + 1 }, (_, index) => ({
      ...entry("A", `2026-10-20-${index}.md`),
      tags: [`tag-${index}`],
    }));

    const insights = vaultInsights(notes, null, NOW);

    expect(insights.tags).toBe(INSIGHT_ROWS + 1);
    expect(insights.topTags).toHaveLength(INSIGHT_ROWS);
  });
});

describe("vaultInsights - how recently it grew", () => {
  it("counts a note inside the window and skips one before it", () => {
    const notes = [
      entry("A", "2026-10-26-today.md", "2026-10-26T09:00:00.000Z"),
      entry("A", "2026-10-01-old.md", "2026-10-01T09:00:00.000Z"),
    ];

    const insights = vaultInsights(notes, null, NOW);

    expect(insights.thisWeek).toBe(1);
    expect(insights.thisMonth).toBe(2);
  });

  it("does not count a date in the future or one the vault cannot parse", () => {
    const notes = [
      entry("A", "2026-11-30-later.md", "2026-11-30T09:00:00.000Z"),
      { ...entry("A", "broken.md"), created: "not a date" },
    ];

    const insights = vaultInsights(notes, null, NOW);

    expect(insights.thisWeek).toBe(0);
    expect(insights.thisMonth).toBe(0);
  });
});

describe("vaultInsights - an empty vault", () => {
  it("answers zeros and empty lists instead of throwing", () => {
    const insights = vaultInsights([], { nodes: [], edges: [], unresolved: [] }, NOW);

    expect(insights).toEqual({
      notes: 0,
      folders: 0,
      tags: 0,
      links: 0,
      unresolved: 0,
      linksKnown: true,
      thisWeek: 0,
      thisMonth: 0,
      orphanCount: 0,
      mostLinked: [],
      orphans: [],
      topTags: [],
      perFolder: [],
    });
  });
});
