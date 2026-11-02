import { describe, expect, it } from "vitest";
import { READING_WORDS_PER_MINUTE, createSlugger, outlineOf, readingStats } from "./note-text";

describe("outlineOf", () => {
  it("lists h2 and h3 in order, and ignores the title and deeper headings", () => {
    const outline = outlineOf("# Title\n\n## One\n\ntext\n\n### Under one\n\n#### Detail");

    expect(outline.map((heading) => [heading.level, heading.text])).toEqual([
      [2, "One"],
      [3, "Under one"],
    ]);
  });

  it("gives each heading the id the renderer would", () => {
    expect(outlineOf("## Hello, world!\n\n### What's next?").map((h) => h.id)).toEqual([
      "hello-world",
      "whats-next",
    ]);
  });

  it("makes a repeated heading unique instead of giving two elements one id", () => {
    expect(outlineOf("## Notes\n\ntext\n\n## Notes").map((h) => h.id)).toEqual([
      "notes",
      "notes-2",
    ]);
  });

  it("strips inline Markdown from the label and the slug alike", () => {
    const [heading] = outlineOf("## The **important** `id` field");

    expect(heading.text).toBe("The important id field");
    expect(heading.id).toBe("the-important-id-field");
  });

  it("reads a wikilink heading by its alias or its target", () => {
    expect(outlineOf("## [[Learn Rust|Rust notes]]")[0].text).toBe("Rust notes");
    expect(outlineOf("## [[Learn Rust]]")[0].text).toBe("Learn Rust");
  });

  it("drops a closing sequence of hashes but keeps a hash inside the words", () => {
    expect(outlineOf("## C# ##").map((h) => h.text)).toEqual(["C#"]);
  });

  it("does not treat a heading inside a fence as a section", () => {
    const outline = outlineOf("## Real\n\n```md\n## Not a section\n```\n\n## Also real");

    expect(outline.map((h) => h.text)).toEqual(["Real", "Also real"]);
  });

  it("answers an empty body with no sections", () => {
    expect(outlineOf("")).toEqual([]);
    expect(outlineOf("just prose")).toEqual([]);
  });
});

describe("createSlugger", () => {
  it("survives a heading with nothing sluggable left", () => {
    const slug = createSlugger();

    expect(slug("###")).toBe("section");
    expect(slug("!!!")).toBe("section-2");
  });
});

describe("readingStats", () => {
  it("counts words and rounds the reading time up", () => {
    const text = Array.from({ length: READING_WORDS_PER_MINUTE + 1 }, () => "word").join(" ");

    expect(readingStats(text)).toEqual({ words: READING_WORDS_PER_MINUTE + 1, minutes: 2 });
  });

  it("calls any short note one minute rather than zero", () => {
    expect(readingStats("three short words")).toEqual({ words: 3, minutes: 1 });
  });

  it("does not count Markdown syntax as words", () => {
    expect(readingStats("# Title\n\n- one\n- two").words).toBe(3);
  });

  it("leaves code samples out of the estimate", () => {
    const sample = "```js\nconst answer = 42;\n```";
    const stats = readingStats(`two words\n\n${sample}`);

    expect(stats.words).toBe(2);
    expect(stats.minutes).toBe(1);
  });

  it("answers an empty note with nothing to read", () => {
    expect(readingStats("")).toEqual({ words: 0, minutes: 0 });
  });
});
