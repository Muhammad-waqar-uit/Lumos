import { describe, expect, it } from "vitest";
import type { VaultEntry } from "@lumos/shared";
import { RECENT_LIMIT, recentEntries, rememberRecent } from "./recent";

function entry(folder: string, title: string): VaultEntry {
  return {
    folder,
    file: `/vault/${folder}/${title}.md`,
    name: `${title}.md`,
    title,
    created: "2026-10-20T00:00:00.000Z",
    tags: [],
    excerpt: "",
  };
}

const notes = [
  entry("Ideas", "Kyoto trip"),
  entry("Reading", "Rust async"),
  entry("Goals", "Ship the CLI"),
];

describe("rememberRecent", () => {
  it("puts the note just opened at the front", () => {
    expect(rememberRecent(["a/b.md"], "c/d.md")).toEqual(["c/d.md", "a/b.md"]);
  });

  it("moves a note that is opened again instead of listing it twice", () => {
    expect(rememberRecent(["a.md", "b.md", "c.md"], "c.md")).toEqual(["c.md", "a.md", "b.md"]);
  });

  it("caps the list at the limit, oldest last", () => {
    const keys = ["a.md", "b.md", "c.md", "d.md", "e.md"];
    expect(rememberRecent(keys, "f.md", RECENT_LIMIT)).toEqual([
      "f.md",
      "a.md",
      "b.md",
      "c.md",
      "d.md",
    ]);
  });

  it("takes the limit from the caller and leaves the list it was given alone", () => {
    const keys = ["a.md", "b.md"];
    expect(rememberRecent(keys, "c.md", 2)).toEqual(["c.md", "a.md"]);
    expect(keys).toEqual(["a.md", "b.md"]);
  });

  it("starts from nothing", () => {
    expect(rememberRecent([], "a/b.md")).toEqual(["a/b.md"]);
  });
});

describe("recentEntries", () => {
  it("resolves keys to the loaded notes in the order they were opened", () => {
    expect(recentEntries(["Goals/Ship the CLI.md", "Ideas/Kyoto trip.md"], notes)).toEqual([
      notes[2],
      notes[0],
    ]);
  });

  it("skips a note that left the vault instead of offering an empty row", () => {
    expect(recentEntries(["Gone/missing.md", "Reading/Rust async.md"], notes)).toEqual([notes[1]]);
  });

  it("returns nothing for an empty history, which is the first run", () => {
    expect(recentEntries([], notes)).toEqual([]);
  });

  it("takes its own limit, so the palette can ask for fewer than the history holds", () => {
    const keys = ["Goals/Ship the CLI.md", "Ideas/Kyoto trip.md", "Reading/Rust async.md"];
    expect(recentEntries(keys, notes, 2)).toEqual([notes[2], notes[0]]);
  });

  it("ignores a key that repeats", () => {
    const twice = ["Ideas/Kyoto trip.md", "Ideas/Kyoto trip.md"];
    expect(recentEntries(twice, notes)).toEqual([notes[0]]);
  });
});
