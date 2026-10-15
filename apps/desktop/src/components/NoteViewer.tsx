import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Note } from "@lumos/shared";
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

export function NoteViewer({ note, connection }: { note: Note | null; connection: Connection }) {
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
      {link ? <LinkPane url={link} connection={connection} /> : null}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {note.content.trim() ? (
          <article className="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
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
