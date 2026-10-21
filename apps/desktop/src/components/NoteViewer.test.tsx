import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Note } from "@lumos/shared";
import { NoteViewer } from "./NoteViewer";

/** The viewer renders to a string in Node, so the markdown pipeline is testable without jsdom. */
function render(content: string): string {
  const note: Note = {
    title: "Snippet",
    folder: "Reading",
    file: "/vault/Reading/Snippet.md",
    frontmatter: {
      source: "desktop",
      created: "2026-10-20T09:00:00.000Z",
      tags: [],
      status: "new",
    },
    content,
  };
  return renderToStaticMarkup(
    <NoteViewer note={note} connection="daemon" backlinks={[]} onOpenNote={() => {}} />,
  );
}

const fenced = (language: string, body: string): string => `\`\`\`${language}\n${body}\n\`\`\``;

describe("NoteViewer code blocks", () => {
  it("highlights a fence that names a registered language", () => {
    const html = render(fenced("js", "const answer = 42;"));
    expect(html).toContain("language-js");
    expect(html).toContain('class="hljs-keyword">const</span>');
    expect(html).toContain('class="hljs-number">42</span>');
  });

  it("keeps a fence written in an unregistered language as plain text", () => {
    const html = render(fenced("zig", "const std = @import(std);"));
    expect(html).toContain("const std = @import(std);");
    expect(html).not.toContain("hljs-keyword");
  });

  it("does not guess the language of an untagged fence", () => {
    const html = render(fenced("", "const answer = 42;"));
    expect(html).toContain("const answer = 42;");
    expect(html).not.toContain("hljs");
  });
});
