import { describe, expect, it } from "vitest";
import type { GraphSourceNote } from "@lumos/shared";
import {
  backlinks,
  buildGraphFromNotes,
  extractLinks,
  extractTags,
  linkResolver,
  neighborhood,
  rewriteLinks,
} from "./graph";

/** A note fixture with sensible defaults, so each test only states what it cares about. */
function note(
  id: string,
  title: string,
  content: string,
  extra: Partial<GraphSourceNote> = {},
): GraphSourceNote {
  return {
    id,
    title,
    folder: id.split("/")[0],
    created: "2026-10-13T00:00:00.000Z",
    tags: [],
    content,
    ...extra,
  };
}

const IDEAS = "Ideas/2026-10-13-build-a-habit-tracker.md";
const GOALS = "Goals/2026-10-10-learn-rust.md";
const INBOX = "Inbox/2026-10-09-random-thought.md";

const VAULT: GraphSourceNote[] = [
  note(
    IDEAS,
    "Build a habit tracker",
    [
      "# Build a habit tracker",
      "",
      "Pairs with [[Learn Rust]] and again [[Learn Rust]].",
      "Also [[2026-10-10-learn-rust]] and [[ghost-note]].",
    ].join("\n"),
    { tags: ["ideas"] },
  ),
  note(GOALS, "Learn Rust", "# Learn Rust\n\nShip a CLI in #rust\n", {
    created: "2026-10-10T00:00:00.000Z",
  }),
  note(INBOX, "Random thought", "# Random thought\n\nnothing linking here\n", {
    created: "2026-10-09T00:00:00.000Z",
  }),
];

describe("extractLinks", () => {
  it("returns nothing for a body with no links", () => {
    expect(extractLinks("# Title\n\nplain text")).toEqual([]);
  });

  it("finds a wikilink", () => {
    expect(extractLinks("see [[Build a habit tracker]]")).toEqual([
      { target: "Build a habit tracker", alias: null, heading: null, embed: false },
    ]);
  });

  it("keeps the text after a pipe as the alias", () => {
    expect(extractLinks("[[Build a habit tracker|the tracker]]")).toEqual([
      { target: "Build a habit tracker", alias: "the tracker", heading: null, embed: false },
    ]);
  });

  it("separates a heading reference from the target and the alias", () => {
    expect(extractLinks("[[Rust#Async|the async part]]")).toEqual([
      { target: "Rust", alias: "the async part", heading: "Async", embed: false },
    ]);
  });

  it("marks an embed with a bang", () => {
    expect(extractLinks("![[diagram.png]]")).toEqual([
      { target: "diagram.png", alias: null, heading: null, embed: true },
    ]);
  });

  it("ignores a link that only points at a heading in the same note", () => {
    expect(extractLinks("[[#Local heading]]")).toEqual([]);
  });

  it("finds a relative markdown link and drops the .md extension", () => {
    expect(extractLinks("[the tracker](Build%20a%20habit%20tracker.md)")).toEqual([
      { target: "Build a habit tracker", alias: null, heading: null, embed: false },
    ]);
  });

  it("reads a heading out of a markdown link", () => {
    expect(extractLinks("[a](Goals/Learn%20Rust.md#Async)")).toEqual([
      { target: "Goals/Learn Rust", alias: null, heading: "Async", embed: false },
    ]);
  });

  it("ignores external, mail and same-page links", () => {
    expect(extractLinks("[x](https://example.com/note.md)")).toEqual([]);
    expect(extractLinks("[x](mailto:someone@example.com)")).toEqual([]);
    expect(extractLinks("[x](#Heading)")).toEqual([]);
  });

  it("ignores links to non-markdown files, which are attachments", () => {
    expect(extractLinks("[x](diagram.png)")).toEqual([]);
  });

  it("ignores links inside fenced code and inline code", () => {
    const body = ["```", "[[fenced out]]", "```", "keep `[[inline out]]` too", "and [[kept]]"].join(
      "\n",
    );
    expect(extractLinks(body)).toEqual([
      { target: "kept", alias: null, heading: null, embed: false },
    ]);
  });

  it("returns links in the order they appear, duplicates included", () => {
    expect(extractLinks("[[A]] then [b](B.md) then [[A]]")).toEqual([
      { target: "A", alias: null, heading: null, embed: false },
      { target: "B", alias: null, heading: null, embed: false },
      { target: "A", alias: null, heading: null, embed: false },
    ]);
  });
});

describe("extractTags", () => {
  it("finds inline tags and lower-cases them", () => {
    expect(extractTags("ideas about #Rust and #rust-async")).toEqual(["rust", "rust-async"]);
  });

  it("does not mistake a markdown heading for a tag", () => {
    expect(extractTags("# Heading\n\nbody with no tags")).toEqual([]);
  });

  it("stops at punctuation", () => {
    expect(extractTags("ship it #rust.")).toEqual(["rust"]);
  });

  it("keeps nested tags", () => {
    expect(extractTags("part of #project/lumos")).toEqual(["project/lumos"]);
  });

  it("ignores a hash inside a word", () => {
    expect(extractTags("issue foo#bar")).toEqual([]);
  });

  it("ignores tags inside code", () => {
    expect(extractTags("`#nope`\n\n```\n#also-no\n```\n#yes")).toEqual(["yes"]);
  });

  it("merges frontmatter tags first, without duplicates", () => {
    expect(extractTags("body mentions #rust", ["rust", "Ideas"])).toEqual(["rust", "ideas"]);
  });
});

describe("buildGraphFromNotes", () => {
  const graph = buildGraphFromNotes(VAULT);
  const node = (id: string) => graph.nodes.find((n) => n.id === id);

  it("creates a node per note plus one per tag", () => {
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["#ideas", "#rust", GOALS, IDEAS, INBOX]);
  });

  it("counts a repeated link as one edge", () => {
    const links = graph.edges.filter((e) => e.kind === "link" && e.source === IDEAS);
    expect(links).toEqual([{ source: IDEAS, target: GOALS, kind: "link" }]);
  });

  it("resolves a link written as a bare filename stem", () => {
    const target = note(GOALS, "Learn Rust", "# Learn Rust\n\nno tags in this one\n");
    const result = buildGraphFromNotes([
      note(IDEAS, "Tracker", "[[2026-10-10-learn-rust]]"),
      target,
    ]);
    expect(result.edges).toEqual([{ source: IDEAS, target: GOALS, kind: "link" }]);
  });

  it("resolves a link by slug and by title case-insensitively", () => {
    const bySlug = buildGraphFromNotes([note("Inbox/a.md", "A", "[[learn-rust]]"), VAULT[1]]);
    expect(bySlug.unresolved).toEqual([]);
    expect(bySlug.edges).toContainEqual({ source: "Inbox/a.md", target: GOALS, kind: "link" });

    const byTitle = buildGraphFromNotes([note("Inbox/a.md", "A", "[[lEaRn RuSt]]"), VAULT[1]]);
    expect(byTitle.edges).toContainEqual({ source: "Inbox/a.md", target: GOALS, kind: "link" });
  });

  it("resolves a link through a frontmatter alias", () => {
    const aliased = note(GOALS, "Learn Rust", "# Learn Rust", { aliases: ["Rust plan"] });
    const result = buildGraphFromNotes([note("Inbox/a.md", "A", "[[Rust plan]]"), aliased]);
    expect(result.edges).toContainEqual({ source: "Inbox/a.md", target: GOALS, kind: "link" });
  });

  it("resolves a folder-qualified link to its basename", () => {
    const result = buildGraphFromNotes([note("Inbox/a.md", "A", "[[Goals/Learn Rust]]"), VAULT[1]]);
    expect(result.edges).toContainEqual({ source: "Inbox/a.md", target: GOALS, kind: "link" });
  });

  it("picks the same note every time when a title is ambiguous", () => {
    const first = note("Ideas/notes.md", "Notes", "x");
    const second = note("Inbox/notes.md", "Notes", "y");
    const result = buildGraphFromNotes([second, first, note("Inbox/a.md", "A", "[[Notes]]")]);
    expect(result.edges).toEqual([
      { source: "Inbox/a.md", target: "Ideas/notes.md", kind: "link" },
    ]);
  });

  it("reports an unresolved link once and does not invent a node for it", () => {
    expect(graph.unresolved).toEqual([{ source: IDEAS, target: "ghost-note" }]);
    expect(graph.nodes.some((n) => n.id.includes("ghost-note"))).toBe(false);
  });

  it("links notes to tag nodes from frontmatter and from the body", () => {
    expect(graph.edges).toContainEqual({ source: IDEAS, target: "#ideas", kind: "tag" });
    expect(graph.edges).toContainEqual({ source: GOALS, target: "#rust", kind: "tag" });
    expect(node("#rust")).toMatchObject({ label: "#rust", kind: "tag", inDegree: 1, outDegree: 0 });
  });

  it("sizes nodes by incoming edges and marks the unlinked ones as orphans", () => {
    expect(node(GOALS)).toMatchObject({ inDegree: 1, outDegree: 1, orphan: false });
    expect(node(IDEAS)).toMatchObject({ inDegree: 0, outDegree: 2, orphan: false });
    expect(node(INBOX)).toMatchObject({ inDegree: 0, outDegree: 0, orphan: true });
  });

  it("carries each note's tags onto its node", () => {
    expect(node(IDEAS)?.tags).toEqual(["ideas"]);
    expect(node(GOALS)?.tags).toEqual(["rust"]);
    expect(node(INBOX)?.tags).toEqual([]);
  });

  it("skips a note that links to itself", () => {
    const result = buildGraphFromNotes([note("Inbox/self.md", "Self", "# Self\n\n[[Self]]")]);
    expect(result.edges).toEqual([]);
    expect(result.nodes[0]).toMatchObject({ orphan: true });
  });

  it("handles an empty vault", () => {
    expect(buildGraphFromNotes([])).toEqual({ nodes: [], edges: [], unresolved: [] });
  });
});

describe("backlinks", () => {
  const graph = buildGraphFromNotes(VAULT);

  it("lists the notes that link to the target, even when they link more than once", () => {
    // IDEAS links to Learn Rust twice, plus once by filename; one backlink, not three.
    expect(backlinks(graph, GOALS).map((node) => node.id)).toEqual([IDEAS]);
  });

  it("returns nothing for a note that nothing points at", () => {
    expect(backlinks(graph, IDEAS)).toEqual([]);
  });

  it("does not treat a shared tag as a backlink", () => {
    const tagged = buildGraphFromNotes([
      note("Inbox/a.md", "A", "# A\n\n#rust"),
      note("Inbox/b.md", "B", "# B\n\n#rust"),
    ]);
    expect(backlinks(tagged, "Inbox/a.md")).toEqual([]);
    // The tag node itself has tag edges pointing at it, which are not note backlinks either.
    expect(backlinks(tagged, "#rust")).toEqual([]);
  });

  it("lists every source note once, in node order", () => {
    const linked = buildGraphFromNotes([
      note("Inbox/c.md", "C", "[[D]]"),
      note("Inbox/b.md", "B", "[[D]]"),
      note("Inbox/d.md", "D", "no links"),
    ]);
    expect(backlinks(linked, "Inbox/d.md").map((node) => node.id)).toEqual([
      "Inbox/b.md",
      "Inbox/c.md",
    ]);
  });

  it("returns an empty list for an unknown id", () => {
    expect(backlinks(graph, "Inbox/missing.md")).toEqual([]);
  });
});

describe("neighborhood", () => {
  const graph = buildGraphFromNotes(VAULT);

  it("returns the note and its direct neighbours at depth 1", () => {
    const local = neighborhood(graph, GOALS, 1);
    expect(local.nodes.map((n) => n.id).sort()).toEqual(["#rust", GOALS, IDEAS]);
    // Edges stay in the order the builder produced them, which follows the sorted node ids.
    expect(local.edges).toEqual([
      { source: GOALS, target: "#rust", kind: "tag" },
      { source: IDEAS, target: GOALS, kind: "link" },
    ]);
  });

  it("reaches a second hop at depth 2", () => {
    const result = buildGraphFromNotes([
      note("Inbox/a.md", "A", "[[B]]"),
      note("Inbox/b.md", "B", "[[C]]"),
      note("Inbox/c.md", "C", "[[D]]"),
      note("Inbox/d.md", "D", "no links"),
    ]);
    expect(
      neighborhood(result, "Inbox/a.md", 1)
        .nodes.map((n) => n.id)
        .sort(),
    ).toEqual(["Inbox/a.md", "Inbox/b.md"]);
    expect(
      neighborhood(result, "Inbox/a.md", 2)
        .nodes.map((n) => n.id)
        .sort(),
    ).toEqual(["Inbox/a.md", "Inbox/b.md", "Inbox/c.md"]);
  });

  it("drops edges whose other end fell outside the subgraph", () => {
    const result = buildGraphFromNotes([
      note("Inbox/a.md", "A", "[[B]] [[D]]"),
      note("Inbox/b.md", "B", "no links"),
      note("Inbox/c.md", "C", "[[D]]"),
      note("Inbox/d.md", "D", "no links"),
    ]);
    const local = neighborhood(result, "Inbox/a.md", 1);
    expect(local.nodes.map((n) => n.id).sort()).toEqual(["Inbox/a.md", "Inbox/b.md", "Inbox/d.md"]);
    // c.md links to d.md, but c.md is outside this local graph, so that edge must not arrive.
    expect(local.edges).toEqual([
      { source: "Inbox/a.md", target: "Inbox/b.md", kind: "link" },
      { source: "Inbox/a.md", target: "Inbox/d.md", kind: "link" },
    ]);
  });

  it("returns just the note at depth 0", () => {
    const local = neighborhood(graph, GOALS, 0);
    expect(local.nodes.map((n) => n.id)).toEqual([GOALS]);
    expect(local.edges).toEqual([]);
  });

  it("returns an empty graph for an unknown id", () => {
    expect(neighborhood(graph, "Inbox/missing.md", 2)).toEqual({
      nodes: [],
      edges: [],
      unresolved: [],
    });
  });

  it("keeps unresolved links that belong to an included note", () => {
    expect(neighborhood(graph, IDEAS, 1).unresolved).toEqual([
      { source: IDEAS, target: "ghost-note" },
    ]);
  });
});

describe("linkResolver", () => {
  it("finds a note by title, filename, slug or alias, and nothing else", () => {
    const resolve = linkResolver([
      note(GOALS, "Learn Rust", "", { aliases: ["rust plan"] }),
      note(INBOX, "Random thought", ""),
    ]);

    expect(resolve("Learn Rust")).toBe(GOALS);
    expect(resolve("learn rust")).toBe(GOALS);
    expect(resolve("2026-10-10-learn-rust")).toBe(GOALS);
    expect(resolve("Goals/2026-10-10-learn-rust.md")).toBe(GOALS);
    expect(resolve("rust plan")).toBe(GOALS);
    expect(resolve("ghost-note")).toBeNull();
  });
});

describe("rewriteLinks", () => {
  /** Rename `Learn Rust` to `Learn Rust properly`, the way a rename asks for it. */
  const rename = (target: string): string | null =>
    target.toLowerCase() === "learn rust" ? "Learn Rust properly" : null;

  it("rewrites the target and says how many links changed", () => {
    const { text, count } = rewriteLinks("see [[Learn Rust]] and [[Learn Rust]]", rename);

    expect(count).toBe(2);
    expect(text).toBe("see [[Learn Rust properly]] and [[Learn Rust properly]]");
  });

  it("keeps a heading, an alias and an embed marker", () => {
    const { text } = rewriteLinks("[[Learn Rust#Ship a CLI|the plan]] and ![[Learn Rust]]", rename);

    expect(text).toBe("[[Learn Rust properly#Ship a CLI|the plan]] and ![[Learn Rust properly]]");
  });

  it("leaves a link the callback does not recognise exactly as written", () => {
    const { text, count } = rewriteLinks("[[Other note]] and [[Learn Rust]]", rename);

    expect(count).toBe(1);
    expect(text).toBe("[[Other note]] and [[Learn Rust properly]]");
  });

  it("skips fenced code and inline code, which the graph does not read as links", () => {
    const body = [
      "a [[Learn Rust]]",
      "",
      "```md",
      "[[Learn Rust]]",
      "```",
      "",
      "`[[Learn Rust]]`",
    ].join("\n");
    const { text, count } = rewriteLinks(body, rename);

    expect(count).toBe(1);
    expect(text).toBe(
      [
        "a [[Learn Rust properly]]",
        "",
        "```md",
        "[[Learn Rust]]",
        "```",
        "",
        "`[[Learn Rust]]`",
      ].join("\n"),
    );
  });

  it("rewrites a markdown link to a note, keeping its text and its anchor", () => {
    // The callback sees the decoded path, which is what a note's filename looks like on disk.
    const asFilename = (target: string): string | null =>
      target === "Learn Rust.md" ? "Learn-Rust-properly.md" : null;
    const { text, count } = rewriteLinks(
      "[the plan](Learn%20Rust.md#ship-a-cli) and [a page](https://example.com/x.md)",
      asFilename,
    );

    expect(count).toBe(1);
    expect(text).toBe(
      "[the plan](Learn-Rust-properly.md#ship-a-cli) and [a page](https://example.com/x.md)",
    );
  });

  it("says nothing changed when the body carries no matching link", () => {
    const { text, count } = rewriteLinks("# A note\n\nplain prose, [[Somewhere else]]", rename);

    expect(count).toBe(0);
    expect(text).toBe("# A note\n\nplain prose, [[Somewhere else]]");
  });
});
