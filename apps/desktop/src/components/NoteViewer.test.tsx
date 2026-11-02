import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_FOLDERS, type Note } from "@lumos/shared";
import { NoteViewer } from "./NoteViewer";

/** The viewer renders to a string in Node, so the markdown pipeline is testable without jsdom. */
function render(
  content: string,
  problems: string[] = [],
  connection: "daemon" | "demo" = "daemon",
  related: { id: string; label: string; folder: string; reasons: string[] }[] = [],
  pin: { pinned?: boolean; full?: boolean } = {},
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
      related={related}
      pinned={pin.pinned ?? false}
      pinFull={pin.full ?? false}
      onTogglePin={() => {}}
      onOpenNote={() => {}}
      onSave={async () => note}
      onRename={async () => {}}
      onMove={async () => {}}
      onDelete={async () => {}}
      folders={DEFAULT_FOLDERS}
      onTags={async () => {}}
      onStatus={async () => {}}
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

describe("NoteViewer related notes", () => {
  it("offers the notes beside this one, with the reason", () => {
    const html = render("body", [], "daemon", [
      {
        id: "Ideas/morning-walk.md",
        label: "Morning walk",
        folder: "Ideas",
        reasons: ["#health"],
      },
    ]);

    expect(html).toContain('aria-label="Related notes"');
    expect(html).toContain("Morning walk");
    expect(html).toContain("#health");
  });

  it("says nothing when nothing is related", () => {
    expect(render("body")).not.toContain('aria-label="Related notes"');
  });
});

describe("NoteViewer pinning", () => {
  it("offers to pin the open note", () => {
    const html = render("body");

    expect(html).toContain(">Pin</button>");
    expect(html).toContain('aria-pressed="false"');
  });

  it("shows a pinned note as pinned", () => {
    const html = render("body", [], "daemon", [], { pinned: true });

    expect(html).toContain(">Pinned</button>");
    expect(html).toContain('aria-pressed="true"');
  });

  it("disables the control when the profile has no room for another pin", () => {
    const html = render("body", [], "daemon", [], { full: true });

    expect(html).toContain("disabled");
    expect(html).toContain("No room for another pin");
  });
});

describe("NoteViewer reading aids", () => {
  it("lists the note's sections and points them at the rendered headings", () => {
    const html = render("# Read me\n\ntext\n\n## First\n\nmore\n\n### Detail\n\n## Second");

    expect(html).toContain('aria-label="Contents"');
    expect(html).toContain('id="first"');
    expect(html).toContain('id="detail"');
    expect(html).toContain('id="second"');
    expect(html).toContain(">First</button>");
  });

  it("leaves out a note with fewer than two sections", () => {
    expect(render("# Title\n\n## Only one")).not.toContain('aria-label="Contents"');
  });

  it("reports the word count and the reading time", () => {
    const html = render("one two three four");

    expect(html).toContain("4 words");
    expect(html).toContain("1 min read");
  });

  it("says nothing about length for an empty note", () => {
    expect(render("")).not.toContain("min read");
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
