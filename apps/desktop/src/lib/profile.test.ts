// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  BIO_MAX,
  DEFAULT_PROFILE,
  NAME_MAX,
  PIN_LIMIT,
  parseProfile,
  profileInitial,
  useProfileStore,
  withPin,
} from "./profile";

beforeEach(() => {
  localStorage.clear();
  useProfileStore.setState({ name: "", bio: "", pins: [] });
});

describe("parseProfile", () => {
  it("falls back to the default for anything that is not a profile", () => {
    for (const raw of [null, "", "{", "[]", '"a string"', "null"]) {
      expect(parseProfile(raw)).toEqual(DEFAULT_PROFILE);
    }
  });

  it("keeps the fields it can use and drops the ones it cannot", () => {
    const profile = parseProfile(
      JSON.stringify({ name: "  Waqar  ", bio: 42, pins: "Inbox/a.md", extra: true }),
    );
    expect(profile).toEqual({ name: "Waqar", bio: "", pins: [] });
  });

  it("trims, caps and de-duplicates the pins, and refuses more than the limit", () => {
    const pins = [
      "Inbox/a.md",
      "Inbox/a.md",
      "",
      7,
      ...Array.from({ length: PIN_LIMIT + 3 }, (_, index) => `Ideas/n${index}.md`),
    ];
    const profile = parseProfile(JSON.stringify({ pins }));
    expect(profile.pins).toHaveLength(PIN_LIMIT);
    expect(profile.pins[0]).toBe("Inbox/a.md");
    expect(new Set(profile.pins).size).toBe(profile.pins.length);
  });

  it("caps a stored name and bio rather than letting them push the pane apart", () => {
    const profile = parseProfile(JSON.stringify({ name: "x".repeat(200), bio: "y".repeat(500) }));
    expect(profile.name).toHaveLength(NAME_MAX);
    expect(profile.bio).toHaveLength(BIO_MAX);
  });
});

describe("withPin", () => {
  it("pins, then unpins the same note", () => {
    const pinned = withPin(DEFAULT_PROFILE, "Inbox/a.md");
    expect(pinned.pins).toEqual(["Inbox/a.md"]);
    expect(withPin(pinned, "Inbox/a.md").pins).toEqual([]);
  });

  it("stops at the limit, handing back the same profile", () => {
    let profile = DEFAULT_PROFILE;
    for (let index = 0; index < PIN_LIMIT; index += 1) profile = withPin(profile, `n${index}.md`);
    expect(withPin(profile, "one-too-many.md")).toBe(profile);
  });
});

describe("the profile store", () => {
  it("writes the name and line through to storage", () => {
    useProfileStore.getState().save("  Waqar ", "  notes on rust ");

    const stored = JSON.parse(localStorage.getItem("lumos.profile.v1") ?? "{}");
    expect(stored).toEqual({ name: "Waqar", bio: "notes on rust", pins: [] });
    expect(useProfileStore.getState().name).toBe("Waqar");
  });

  it("keeps the pins when the name is saved, and the name when a pin changes", () => {
    useProfileStore.getState().save("Waqar", "");
    useProfileStore.getState().togglePin("Inbox/a.md");
    useProfileStore.getState().save("Someone else", "");

    const stored = JSON.parse(localStorage.getItem("lumos.profile.v1") ?? "{}");
    expect(stored).toEqual({ name: "Someone else", bio: "", pins: ["Inbox/a.md"] });
    expect(useProfileStore.getState().pins).toEqual(["Inbox/a.md"]);
  });

  it("survives a corrupt stored profile instead of failing to load", () => {
    localStorage.setItem("lumos.profile.v1", "{not json");
    expect(parseProfile(localStorage.getItem("lumos.profile.v1"))).toEqual(DEFAULT_PROFILE);
  });
});

describe("profileInitial", () => {
  it("uses the first letter of the name, or the app's when there is none", () => {
    expect(profileInitial("waqar")).toBe("W");
    expect(profileInitial("  ")).toBe("L");
    expect(profileInitial("")).toBe("L");
  });
});
