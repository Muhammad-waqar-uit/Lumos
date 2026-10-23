import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Note } from "@lumos/shared";
import { NoteViewer } from "./NoteViewer";

/** The viewer renders to a string in Node, so the markdown pipeline is testable without jsdom. */
function render(
  content: string,
  problems: string[] = [],
  connection: "daemon" | "demo" = "daemon",
): string {
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
    problems,
  };
  return renderToStaticMarkup(
    <NoteViewer
      note={note}
      connection={connection}
      backlinks={[]}
      onOpenNote={() => {}}
      onSave={async () => note}
      onRename={async () => {}}
      onMove={async () => {}}
      onDelete={async () => {}}
    />,
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

describe("NoteViewer editing", () => {
  it("offers to edit the open note", () => {
    expect(render("body")).toContain(">Edit</button>");
  });

  it("offers no edit offline, and says why", () => {
    const html = render("body", [], "demo");
    expect(html).toContain("disabled");
    expect(html).toContain('title="Editing needs the daemon"');
  });
});

describe("NoteViewer file operations", () => {
  it("offers the file operations beside Edit", () => {
    const html = render("body");
    expect(html).toContain('aria-label="Note actions"');
    expect(html).not.toContain('title="File changes need the daemon"');
  });

  it("offers none of them offline, because there is no file behind a demo note", () => {
    const html = render("body", [], "demo");
    expect(html).toContain('title="File changes need the daemon"');
  });

  it("keeps the panel closed until it is asked for", () => {
    expect(render("body")).not.toContain("Rename");
  });
});

describe("NoteViewer frontmatter problems", () => {
  it("says nothing about a note that is fine", () => {
    expect(render("body")).not.toContain("Frontmatter problems");
  });

  it("lists what is wrong, and still renders the body", () => {
    const html = render("still readable", ["created is not a date"]);
    // The apostrophe is escaped in the markup, so the assertion stops before it.
    expect(html).toContain("frontmatter has a problem");
    expect(html).toContain("created is not a date");
    expect(html).toContain("still readable");
  });

  it("counts more than one problem", () => {
    const html = render("body", ["created is missing", "url is not an http address"]);
    expect(html).toContain("has 2 problems");
  });
});
