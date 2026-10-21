import { describe, expect, it } from "vitest";
import { validateFrontmatter } from "./frontmatter";

/** A minimal note that passes every rule, so each test can change exactly one field. */
const GOOD = {
  source: "whatsapp",
  created: "2026-10-13T09:12:00.000Z",
  tags: ["rust", "cli"],
  status: "new",
};

describe("validateFrontmatter", () => {
  it("accepts a complete note", () => {
    expect(validateFrontmatter(GOOD)).toEqual([]);
  });

  it("accepts extra keys, because frontmatter is meant to grow", () => {
    expect(validateFrontmatter({ ...GOOD, priority: 3, pinned: true })).toEqual([]);
  });

  it("rejects a block that is not a mapping", () => {
    expect(validateFrontmatter(["a", "b"])).toEqual(["frontmatter is not a mapping"]);
    expect(validateFrontmatter("just a string")).toEqual(["frontmatter is not a mapping"]);
    expect(validateFrontmatter(null)).toEqual(["frontmatter is not a mapping"]);
  });

  it("reports a missing created date", () => {
    expect(validateFrontmatter({ source: "whatsapp", tags: [], status: "new" })).toEqual([
      "created is missing",
    ]);
    expect(validateFrontmatter({ ...GOOD, created: "" })).toEqual(["created is missing"]);
    expect(validateFrontmatter({ ...GOOD, created: null })).toEqual(["created is missing"]);
  });

  it("reports a created date that cannot be parsed", () => {
    expect(validateFrontmatter({ ...GOOD, created: "yesterday-ish" })).toEqual([
      "created is not a date",
    ]);
    expect(validateFrontmatter({ ...GOOD, created: 20261013 })).toEqual(["created is not a date"]);
  });

  it("accepts a date-only timestamp and a native Date", () => {
    expect(validateFrontmatter({ ...GOOD, created: "2026-10-13" })).toEqual([]);
    expect(validateFrontmatter({ ...GOOD, created: new Date("2026-10-13T09:12:00Z") })).toEqual([]);
  });

  it("accepts tags as one string, which the listing turns into a one-item list", () => {
    expect(validateFrontmatter({ ...GOOD, tags: "rust" })).toEqual([]);
    expect(validateFrontmatter({ ...GOOD, tags: null })).toEqual([]);
  });

  it("reports tags that are not names", () => {
    const problem = ["tags is not a list of names"];
    expect(validateFrontmatter({ ...GOOD, tags: 42 })).toEqual(problem);
    expect(validateFrontmatter({ ...GOOD, tags: ["rust", ""] })).toEqual(problem);
    expect(validateFrontmatter({ ...GOOD, tags: ["rust", 7] })).toEqual(problem);
    expect(validateFrontmatter({ ...GOOD, tags: { rust: true } })).toEqual(problem);
    expect(validateFrontmatter({ ...GOOD, tags: ["rust", "  "] })).toEqual(problem);
  });

  it("reports a source that is not a name", () => {
    expect(validateFrontmatter({ ...GOOD, source: "" })).toEqual(["source is not a name"]);
    expect(validateFrontmatter({ ...GOOD, source: 3 })).toEqual(["source is not a name"]);
  });

  it("reports a url that is not an http address", () => {
    const problem = ["url is not an http address"];
    expect(validateFrontmatter({ ...GOOD, url: "example.com/post" })).toEqual(problem);
    expect(validateFrontmatter({ ...GOOD, url: "javascript:alert(1)" })).toEqual(problem);
    expect(validateFrontmatter({ ...GOOD, url: 42 })).toEqual(problem);
  });

  it("accepts a real url, or no url at all", () => {
    expect(validateFrontmatter({ ...GOOD, url: "https://example.com/post" })).toEqual([]);
    expect(validateFrontmatter({ ...GOOD, url: "http://example.com" })).toEqual([]);
    expect(validateFrontmatter({ ...GOOD, url: null })).toEqual([]);
  });

  it("reports every broken field at once, in reading order", () => {
    expect(validateFrontmatter({ created: "soon", tags: [""], source: "" })).toEqual([
      "created is not a date",
      "tags is not a list of names",
      "source is not a name",
    ]);
  });
});
