import { describe, expect, it } from "vitest";
import type { VaultEntry } from "@lumos/shared";
import { keyOfEntry, makeSearchIndex, searchVault } from "./search";

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
  entry({ title: "Rust async", folder: "Reading", tags: ["rust"], excerpt: "tokio runtime" }),
  entry({ title: "Rustacean notes", folder: "Ideas", tags: ["rustacean"], excerpt: "" }),
  entry({ title: "Ship the CLI", folder: "Goals", tags: ["ship", "rust"], excerpt: "by friday" }),
];

const index = makeSearchIndex(notes);
const titles = (results: ReturnType<typeof searchVault>): string[] =>
  results.map((result) => result.entry.title);

describe("searchVault", () => {
  it("returns nothing for an empty or blank query", () => {
    expect(searchVault(index, "")).toEqual([]);
    expect(searchVault(index, "   ")).toEqual([]);
  });

  it("finds a note by its title and puts the strongest match first", () => {
    expect(titles(searchVault(index, "Rust async"))[0]).toBe("Rust async");
  });

  it("ignores case", () => {
    expect(titles(searchVault(index, "KYOTO"))).toContain("Kyoto trip");
  });

  it("matches a tag, not only a title", () => {
    expect(titles(searchVault(index, "travel"))).toEqual(["Kyoto trip"]);
  });

  it("matches the excerpt, which is all the listing knows of the body", () => {
    expect(titles(searchVault(index, "tokio runtime"))).toEqual(["Rust async"]);
  });

  it("tolerates a typo in the query", () => {
    expect(titles(searchVault(index, "Kyto trip"))).toContain("Kyoto trip");
  });

  it("caps the list at the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      entry({ title: `Rust note ${i}`, folder: "Reading", tags: ["rust"] }),
    );
    expect(searchVault(makeSearchIndex(many), "rust", [], 5)).toHaveLength(5);
  });

  it("appends body-only matches the local index could not see, flagged as body matches", () => {
    const bodyOnly = entry({
      title: "Something else",
      excerpt: "an excerpt without the word",
    });

    const results = searchVault(index, "kubernetes", [bodyOnly]);

    expect(results).toHaveLength(1);
    expect(results[0].entry.title).toBe("Something else");
    expect(results[0].body).toBe(true);
  });

  it("does not list a note twice when both searches find it", () => {
    const local = notes[1];
    const results = searchVault(index, "Rust async", [local]);

    expect(results.filter((r) => keyOfEntry(r.entry) === keyOfEntry(local))).toHaveLength(1);
    expect(results[0].body).toBe(false);
  });

  it("counts both sources against one limit", () => {
    const bodyOnly = entry({ title: "Unrelated", excerpt: "nope" });
    const results = searchVault(index, "rust", [bodyOnly], 2);

    expect(results).toHaveLength(2);
  });
});
