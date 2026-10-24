import { describe, expect, it } from "vitest";
import type { VaultEntry } from "@lumos/shared";
import { bulkNotice, runBulk } from "./bulk";

function entry(name: string, folder = "Inbox"): VaultEntry {
  return {
    title: name,
    folder,
    file: `C:/vault/${folder}/${name}.md`,
    name: `${name}.md`,
    created: "2026-10-20T08:00:00.000Z",
    tags: [],
    excerpt: "",
  };
}

const A = entry("alpha");
const B = entry("beta");
const C = entry("gamma", "Ideas");

describe("runBulk", () => {
  it("runs the write over every target and counts them", async () => {
    const seen: string[] = [];
    const summary = await runBulk([A, B, C], async (target) => {
      seen.push(target.name);
    });

    expect(seen).toEqual(["alpha.md", "beta.md", "gamma.md"]);
    expect(summary).toEqual({ done: 3, failures: [] });
  });

  it("keeps going past a refusal and carries the daemon's own sentence for it", async () => {
    const summary = await runBulk([A, B, C], async (target) => {
      if (target.folder === "Ideas") throw new Error('Folder "Ideas" is not one this vault has.');
      if (target.name === "beta.md") throw new Error("That name is already taken.");
    });

    expect(summary.done).toBe(1);
    expect(summary.failures).toEqual([
      { key: "Inbox/beta.md", reason: "That name is already taken." },
      { key: "Ideas/gamma.md", reason: 'Folder "Ideas" is not one this vault has.' },
    ]);
  });

  it("answers a non-Error rejection without leaking whatever the socket said", async () => {
    const summary = await runBulk([A], async () => {
      throw "ECONNREFUSED 127.0.0.1:3001";
    });

    expect(summary.failures).toEqual([{ key: "Inbox/alpha.md", reason: "unknown error" }]);
  });
});

describe("bulkNotice", () => {
  it("says what landed when everything landed", () => {
    expect(bulkNotice("Moved", { done: 3, failures: [] })).toBe("Moved 3 notes.");
    expect(bulkNotice("Moved", { done: 1, failures: [] })).toBe("Moved 1 note.");
  });

  it("names the count that landed and the first reason that did not", () => {
    expect(
      bulkNotice("Moved", {
        done: 2,
        failures: [
          { key: "Inbox/beta.md", reason: "That name is already taken." },
          { key: "Ideas/gamma.md", reason: "Folder gone." },
        ],
      }),
    ).toBe('Moved 2 of 4; "beta.md": That name is already taken.');
  });

  it("says nothing landed when nothing did", () => {
    expect(
      bulkNotice("Archived", { done: 0, failures: [{ key: "Inbox/alpha.md", reason: "No." }] }),
    ).toBe('Archived nothing; "alpha.md": No.');
  });
});
