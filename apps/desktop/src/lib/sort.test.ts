import { describe, expect, it } from "vitest";
import type { VaultEntry } from "@lumos/shared";
import { readSort, sortEntries, writeSort } from "./sort";

function note(overrides: Partial<VaultEntry> & { name: string }): VaultEntry {
  return {
    title: overrides.name,
    folder: "Inbox",
    file: `C:/vault/Inbox/${overrides.name}`,
    created: "2026-10-01T10:00:00.000Z",
    tags: [],
    excerpt: "",
    ...overrides,
  };
}

const NOTES: VaultEntry[] = [
  note({ name: "b.md", title: "banana", created: "2026-10-03T10:00:00.000Z" }),
  note({ name: "a.md", title: "Apple", created: "2026-10-01T10:00:00.000Z" }),
  note({ name: "c.md", title: "cherry", created: "2026-10-02T10:00:00.000Z" }),
];

/** A `Storage` that only remembers what the test puts in it. */
function fakeStorage(initial?: string): Storage {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set("lumos.sort.v1", initial);
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe("sortEntries", () => {
  it("puts the newest first by default", () => {
    expect(sortEntries(NOTES, "newest").map((n) => n.name)).toEqual(["b.md", "c.md", "a.md"]);
  });

  it("reverses that for oldest first", () => {
    expect(sortEntries(NOTES, "oldest").map((n) => n.name)).toEqual(["a.md", "c.md", "b.md"]);
  });

  it("sorts titles alphabetically regardless of case", () => {
    // "Apple" before "banana" is only true because the comparison ignores case; a plain
    // `localeCompare` puts every capitalised title first and reads as broken to a person.
    expect(sortEntries(NOTES, "title").map((n) => n.title)).toEqual(["Apple", "banana", "cherry"]);
  });

  it("keeps a note with an unreadable date last, not at 1970", () => {
    const broken = note({ name: "z.md", title: "zed", created: "not a date" });
    const newest = sortEntries([broken, ...NOTES], "newest");
    const oldest = sortEntries([broken, ...NOTES], "oldest");

    expect(newest[newest.length - 1]?.name).toBe("z.md");
    expect(oldest[oldest.length - 1]?.name).toBe("z.md");
  });

  it("breaks a tie by path, so the order cannot wobble", () => {
    const same = "2026-10-05T10:00:00.000Z";
    const one = note({ name: "b.md", created: same });
    const two = note({ name: "a.md", created: same });

    expect(sortEntries([one, two], "newest").map((n) => n.name)).toEqual(["a.md", "b.md"]);
  });

  it("returns a new array and leaves the input as it was", () => {
    const original = [...NOTES];

    const sorted = sortEntries(NOTES, "title");

    expect(sorted).not.toBe(NOTES);
    expect(NOTES).toEqual(original);
  });
});

describe("the stored order", () => {
  it("reads back the order that was written", () => {
    const storage = fakeStorage();

    writeSort("title", storage);

    expect(readSort(storage)).toBe("title");
  });

  it("falls back to newest for nothing, an old value or a hand-edited one", () => {
    expect(readSort(null)).toBe("newest");
    expect(readSort(fakeStorage())).toBe("newest");
    expect(readSort(fakeStorage("by-magic"))).toBe("newest");
  });

  it("does not throw when the browser refuses to store anything", () => {
    const refusing = {
      ...fakeStorage(),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    } as Storage;

    expect(() => writeSort("oldest", refusing)).not.toThrow();
  });
});
