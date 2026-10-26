// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Folder, VaultEntry } from "@lumos/shared";
import { addedNotes, captureNotice, entryKey } from "./capture";

function entry(title: string, overrides: Partial<VaultEntry> = {}): VaultEntry {
  const name = `${title.toLowerCase().replace(/\s+/g, "-")}.md`;
  return {
    title,
    folder: "Inbox" as Folder,
    file: `/vault/Inbox/${name}`,
    name,
    created: "2026-10-26T09:00:00.000Z",
    tags: [],
    excerpt: "",
    ...overrides,
  };
}

describe("what arrived while the window was open", () => {
  it("finds only the notes that were not in the list before", () => {
    const older = entry("Ship the release");
    const fresh = entry("Plan the week", { folder: "Ideas" as Folder });

    const added = addedNotes(new Set([entryKey(older)]), [fresh, older]);

    expect(added).toEqual([fresh]);
    // The key is the same `Folder/name.md` the list addresses rows by, or a note in another folder
    // with the same filename would look like one that was already there.
    expect(entryKey(fresh)).toBe("Ideas/plan-the-week.md");
  });

  it("finds nothing when the listing is unchanged", () => {
    const note = entry("Ship the release");
    expect(addedNotes(new Set([entryKey(note)]), [note])).toEqual([]);
  });

  it("names one note, because its title is what the capture is", () => {
    const said = captureNotice([entry("Build a habit tracker")]);

    expect(said?.text).toBe('New note from WhatsApp: "Build a habit tracker"');
    expect(said?.open).toEqual({ key: "Inbox/build-a-habit-tracker.md", label: "Open" });
  });

  it("counts several and offers the newest, rather than listing titles in a bar", () => {
    const said = captureNotice([
      entry("Newest", { folder: "Ideas" as Folder }),
      entry("Older"),
      entry("Oldest"),
    ]);

    expect(said?.text).toBe("3 new notes from WhatsApp");
    expect(said?.open).toEqual({ key: "Ideas/newest.md", label: "Open newest" });
  });

  it("says nothing when nothing arrived", () => {
    expect(captureNotice([])).toBeNull();
  });
});
