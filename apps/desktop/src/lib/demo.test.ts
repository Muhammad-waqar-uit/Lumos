import { describe, expect, it } from "vitest";
import { extractTags } from "@lumos/vault-utils/graph";
import { DEMO_NOTES, demoNote } from "./demo";
import { countTags } from "./filter";

describe("demo vault", () => {
  it("lists exactly the tags its bodies carry, so the chips and the graph agree", () => {
    // The demo bodies already had #tags (the offline graph draws them), but the listing entries
    // did not, so the chip row was empty while the graph showed tag nodes.
    for (const note of DEMO_NOTES) {
      const bodyTags = extractTags(demoNote(note).content);
      expect([...note.tags].sort(), note.name).toEqual(bodyTags.sort());
    }
  });

  it("tags more than one note with the same tag, so the offline chip row shows a real count", () => {
    expect(countTags(DEMO_NOTES)[0]?.count ?? 0).toBeGreaterThan(1);
  });

  it("keeps one note untagged, so the no-tag case is visible offline too", () => {
    expect(DEMO_NOTES.some((note) => note.tags.length === 0)).toBe(true);
  });
});
