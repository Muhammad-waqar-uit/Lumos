import { describe, expect, it } from "vitest";
import type { VaultEntry } from "@lumos/shared";
import { countTags, filterEntries, nodeTag } from "./filter";

function entry(over: Partial<VaultEntry> & { title: string }): VaultEntry {
  return {
    folder: "Ideas",
    file: `/vault/Ideas/${over.title}.md`,
    name: `${over.title}.md`,
    created: "2026-10-19T00:00:00.000Z",
    tags: [],
    excerpt: "",
    ...over,
  };
}

const notes: VaultEntry[] = [
  entry({ title: "Kyoto trip", folder: "Ideas", tags: ["travel", "japan"], excerpt: "plan it" }),
  entry({ title: "Rust async", folder: "Reading", tags: ["rust"], excerpt: "tokio" }),
  entry({ title: "Rustacean notes", folder: "Ideas", tags: ["rustacean"], excerpt: "" }),
  entry({ title: "Ship the CLI", folder: "Goals", tags: ["ship", "rust"], excerpt: "by friday" }),
];

const titles = (entries: VaultEntry[]): string[] => entries.map((e) => e.title);

describe("filterEntries", () => {
  it("keeps one folder, or every folder for All", () => {
    expect(titles(filterEntries(notes, { folder: "Ideas", query: "", tag: null }))).toEqual([
      "Kyoto trip",
      "Rustacean notes",
    ]);
    expect(filterEntries(notes, { folder: "All", query: "", tag: null })).toHaveLength(4);
  });

  it("searches the title, the excerpt and the tags", () => {
    expect(titles(filterEntries(notes, { folder: "All", query: "kyoto", tag: null }))).toEqual([
      "Kyoto trip",
    ]);
    expect(titles(filterEntries(notes, { folder: "All", query: "tokio", tag: null }))).toEqual([
      "Rust async",
    ]);
    expect(titles(filterEntries(notes, { folder: "All", query: "japan", tag: null }))).toEqual([
      "Kyoto trip",
    ]);
  });

  it("ignores the query's case and surrounding spaces", () => {
    expect(titles(filterEntries(notes, { folder: "All", query: "  KYOTO ", tag: null }))).toEqual([
      "Kyoto trip",
    ]);
  });

  it("matches a tag exactly rather than as a substring", () => {
    expect(titles(filterEntries(notes, { folder: "All", query: "", tag: "rust" }))).toEqual([
      "Rust async",
      "Ship the CLI",
    ]);
  });

  it("accepts the tag written with its hash, or in another case", () => {
    expect(titles(filterEntries(notes, { folder: "All", query: "", tag: "#RUST" }))).toEqual([
      "Rust async",
      "Ship the CLI",
    ]);
  });

  it("applies the folder, the tag and the query together", () => {
    expect(
      titles(filterEntries(notes, { folder: "Ideas", query: "kyoto", tag: "travel" })),
    ).toEqual(["Kyoto trip"]);
    // The same tag in another folder is excluded by the folder filter, not by the tag.
    expect(filterEntries(notes, { folder: "Reading", query: "", tag: "travel" })).toHaveLength(0);
  });

  it("returns nothing when the tag is on no note in scope", () => {
    expect(filterEntries(notes, { folder: "All", query: "", tag: "missing" })).toHaveLength(0);
  });
});

describe("countTags", () => {
  it("counts each tag once per note, most used first and ties alphabetically", () => {
    expect(countTags(notes)).toEqual([
      { tag: "rust", count: 2 },
      { tag: "japan", count: 1 },
      { tag: "rustacean", count: 1 },
      { tag: "ship", count: 1 },
      { tag: "travel", count: 1 },
    ]);
  });

  it("folds case and the leading hash so one tag is not counted twice", () => {
    const mixed = [
      entry({ title: "one", tags: ["#Rust", "rust"] }),
      entry({ title: "two", tags: ["RUST"] }),
    ];
    expect(countTags(mixed)).toEqual([{ tag: "rust", count: 2 }]);
  });

  it("leaves out an empty tag instead of offering a blank filter", () => {
    expect(countTags([entry({ title: "empty", tags: ["", "  "] })])).toEqual([]);
  });

  it("counts the notes it is given, so the numbers follow the folder and query", () => {
    const inIdeas = filterEntries(notes, { folder: "Ideas", query: "", tag: null });
    expect(countTags(inIdeas).map((t) => t.tag)).toEqual(["japan", "rustacean", "travel"]);
  });
});

describe("nodeTag", () => {
  it("reads a tag from a graph node id and nothing from a note id", () => {
    expect(nodeTag("#Travel")).toBe("travel");
    expect(nodeTag("Ideas/Kyoto trip.md")).toBeNull();
  });
});
