import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import type { GraphNode, Note } from "@lumos/shared";
import { firstExternalLink } from "@lumos/vault-utils/link";
import { type Connection } from "../lib/api";
import { LinkPane } from "./LinkPane";

/** Note links open outside the app window instead of navigating the UI away. */
const markdownComponents: Components = {
  a: ({ href, title, children }) => (
    <a href={href} title={title} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  note: Note | null;
  connection: Connection;
  /** Notes that link here, from the same graph the Graph tab draws. */
  backlinks: GraphNode[];
  onOpenNote: (id: string) => void;
}

export function NoteViewer({ note, connection, backlinks, onOpenNote }: Props) {
  // A note captured from WhatsApp carries its link in the frontmatter and in the body;
  // either one is enough to play or read it here.
  const link = useMemo(() => {
    if (!note) return null;
    return note.frontmatter.url ?? firstExternalLink(note.content);
  }, [note]);

  if (!note) {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Select a note to read it.
      </main>
    );
  }

  const fm = note.frontmatter;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold">{note.title}</h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{note.folder}</span>
          <span>{formatDate(fm.created)}</span>
          <span>source: {fm.source}</span>
          {fm.url ? (
            <a
              href={fm.url}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              {fm.url}
            </a>
          ) : null}
        </p>
      </header>
      {note.problems.length > 0 ? (
        <section
          aria-label="Frontmatter problems"
          className="border-b border-border bg-accent/40 px-6 py-2.5"
        >
          <p className="text-xs font-medium text-foreground">
            {note.problems.length === 1
              ? "This note's frontmatter has a problem"
              : `This note's frontmatter has ${note.problems.length} problems`}
          </p>
          <ul className="mt-1 list-inside list-disc text-[11px] text-muted-foreground">
            {note.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted-foreground">
            The body is still readable; the file's frontmatter is what needs fixing.
          </p>
        </section>
      ) : null}
      {backlinks.length > 0 ? (
        <section aria-label="Linked from" className="border-b border-border px-6 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Linked from {backlinks.length}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {backlinks.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => onOpenNote(node.id)}
                  title={node.id}
                  className="flex items-center gap-1.5 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span className="truncate">{node.label}</span>
                  {node.folder ? <span className="opacity-60">{node.folder}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {link ? <LinkPane url={link} connection={connection} /> : null}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {note.content.trim() ? (
          <article className="markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              // Only a block the author tagged gets highlighted: guessing the language of an
              // untagged block colours prose and JSON alike as something they are not.
              rehypePlugins={[[rehypeHighlight, { detect: false }]]}
              components={markdownComponents}
            >
              {note.content}
            </ReactMarkdown>
          </article>
        ) : (
          <p className="text-sm text-muted-foreground">This note is empty.</p>
        )}
      </div>
    </main>
  );
}
