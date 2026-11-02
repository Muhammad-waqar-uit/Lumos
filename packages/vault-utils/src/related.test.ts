import { describe, expect, it } from "vitest";
import type { GraphData, VaultEntry } from "@lumos/shared";
import { RELATED_LIMIT, relatedNotes } from "./related";

function entry(folder: string, name: string, tags: string[] = [], title = name): VaultEntry {
  return {
    title: title.replace(/\.md$/, ""),
    folder,
    file: `${folder}/${name}`,
    name,
    created: "2026-10-20T09:00:00.000Z",
    tags,
    excerpt: "",
  };
}

function graph(links: [string, string][]): GraphData {
  return {
    nodes: [],
    edges: links.map(([source, target]) => ({ source, target, kind: "link" as const })),
    unresolved: [],
  };
}

const SELF = entry("Inbox", "self.md", ["rust", "goal"], "Self");

describe("relatedNotes", () => {
  it("ranks a note this one links to above one that merely shares a tag", () => {
    const notes = [
      SELF,
      entry("Inbox", "linked.md", [], "Linked"),
      entry("Ideas", "tagged.md", ["rust"], "Tagged"),
    ];
    const near = relatedNotes(
      notes,
      graph([["Inbox/self.md", "Inbox/linked.md"]]),
      "Inbox/self.md",
    );

    expect(near.map((note) => note.id)).toEqual(["Inbox/linked.md", "Ideas/tagged.md"]);
    expect(near[0].reasons).toEqual(["this note links to it"]);
    expect(near[1].reasons).toEqual(["#rust"]);
  });

  it("lets two shared tags outrank one link", () => {
    const notes = [
      SELF,
      entry("Inbox", "linked.md", [], "Linked"),
      entry("Ideas", "both.md", ["rust", "goal"], "Both"),
    ];
    const near = relatedNotes(
      notes,
      graph([["Inbox/self.md", "Inbox/linked.md"]]),
      "Inbox/self.md",
    );

    expect(near.map((note) => note.id)).toEqual(["Ideas/both.md", "Inbox/linked.md"]);
  });

  it("leaves out the notes that link here, because Linked from already shows them", () => {
    const notes = [SELF, entry("Inbox", "backlink.md", ["rust"], "Backlink")];
    const near = relatedNotes(
      notes,
      graph([["Inbox/backlink.md", "Inbox/self.md"]]),
      "Inbox/self.md",
    );

    expect(near).toEqual([]);
  });

  it("never offers the note you are reading", () => {
    const near = relatedNotes([SELF], graph([]), "Inbox/self.md");

    expect(near).toEqual([]);
  });

  it("does not treat a shared folder as a relationship", () => {
    const notes = [SELF, entry("Inbox", "stranger.md", [], "Stranger")];

    expect(relatedNotes(notes, graph([]), "Inbox/self.md")).toEqual([]);
  });

  it("reads tags the way the graph does, and ignores a hash or casing", () => {
    const notes = [SELF, entry("Ideas", "tagged.md", ["#Rust"], "Tagged")];
    const near = relatedNotes(notes, graph([]), "Inbox/self.md");

    expect(near[0].reasons).toEqual(["#rust"]);
  });

  it("stops at the limit it was given", () => {
    const notes = [
      SELF,
      ...Array.from({ length: 8 }, (_, i) => entry("Ideas", `${i}.md`, ["rust"])),
    ];

    expect(relatedNotes(notes, graph([]), "Inbox/self.md", 3)).toHaveLength(3);
    expect(relatedNotes(notes, graph([]), "Inbox/self.md")).toHaveLength(RELATED_LIMIT);
    expect(relatedNotes(notes, graph([]), "Inbox/self.md", 0)).toEqual([]);
  });

  it("answers nothing for a note the listing does not hold", () => {
    expect(relatedNotes([SELF], graph([]), "Ideas/unknown.md")).toEqual([]);
  });

  it("keeps the answer stable when scores tie", () => {
    const notes = [
      SELF,
      entry("Ideas", "b.md", ["rust"], "Beta"),
      entry("Ideas", "a.md", ["rust"], "Alpha"),
    ];
    const near = relatedNotes(notes, graph([]), "Inbox/self.md");

    expect(near.map((note) => note.label)).toEqual(["Alpha", "Beta"]);
  });
});
