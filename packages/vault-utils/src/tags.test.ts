import { describe, expect, it } from "vitest";
import type { VaultEntry } from "@lumos/shared";
import { TAG_RELATED, tagIndex } from "./tags";

function entry(folder: string, name: string, tags: string[]): VaultEntry {
  return {
    title: name.replace(/\.md$/, ""),
    folder,
    file: `${folder}/${name}`,
    name,
    created: "2026-10-20T09:00:00.000Z",
    tags,
    excerpt: "",
  };
}

describe("tagIndex", () => {
  it("counts distinct tags across notes, busiest first and then alphabetically", () => {
    const index = tagIndex([
      entry("Inbox", "a.md", ["rust"]),
      entry("Ideas", "b.md", ["rust", "goal"]),
      entry("Inbox", "c.md", ["goal"]),
      entry("Goals", "d.md", ["goal"]),
      entry("Inbox", "e.md", ["alpha"]),
    ]);

    expect(index.distinct).toBe(3);
    expect(index.tags.map((tag) => [tag.tag, tag.count])).toEqual([
      ["goal", 3],
      ["rust", 2],
      ["alpha", 1],
    ]);
  });

  it("reads a tag the way the graph does: no hash, lower-case, once per note", () => {
    const index = tagIndex([
      entry("Inbox", "a.md", ["#Rust", "rust", "RUST"]),
      entry("Inbox", "b.md", ["rust"]),
    ]);

    expect(index.tags).toHaveLength(1);
    expect(index.tags[0]).toMatchObject({ tag: "rust", count: 2 });
  });

  it("counts the folders a tag spans, busiest first", () => {
    const index = tagIndex([
      entry("Inbox", "a.md", ["rust"]),
      entry("Inbox", "b.md", ["rust"]),
      entry("Ideas", "c.md", ["rust"]),
    ]);

    expect(index.tags[0].folders).toEqual([
      { folder: "Inbox", count: 2 },
      { folder: "Ideas", count: 1 },
    ]);
  });

  it("counts the tags that travel with one, without counting itself", () => {
    const index = tagIndex([
      entry("Inbox", "a.md", ["rust", "goal"]),
      entry("Inbox", "b.md", ["rust", "goal", "reading"]),
      entry("Ideas", "c.md", ["rust", "reading"]),
    ]);

    const rust = index.tags.find((tag) => tag.tag === "rust");
    expect(rust?.related).toEqual([
      { tag: "goal", count: 2 },
      { tag: "reading", count: 2 },
    ]);
    expect(rust?.related.some((pair) => pair.tag === "rust")).toBe(false);
  });

  it("keeps the neighbourhood short", () => {
    const tags = ["one", "two", "three", "four", "five", "six"];
    const index = tagIndex([entry("Inbox", "a.md", tags)]);

    expect(index.tags[1].related).toHaveLength(TAG_RELATED);
  });

  it("says how many notes carry no tag at all", () => {
    const index = tagIndex([
      entry("Inbox", "a.md", ["rust"]),
      entry("Inbox", "b.md", []),
      entry("Inbox", "c.md", []),
    ]);

    expect(index.tagged).toBe(1);
    expect(index.untagged).toBe(2);
  });

  it("answers an empty vault with zeroes rather than refusing", () => {
    expect(tagIndex([])).toEqual({ tags: [], distinct: 0, tagged: 0, untagged: 0 });
  });

  it("does not mutate the listing it was given", () => {
    const notes = [entry("Inbox", "a.md", ["#Rust", "rust"])];
    tagIndex(notes);

    expect(notes[0].tags).toEqual(["#Rust", "rust"]);
  });
});
