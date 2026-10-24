import { useMemo, useState } from "react";
import type { GraphNode, Note } from "@lumos/shared";
import { firstExternalLink } from "@lumos/vault-utils/link";
import { type Connection } from "../lib/api";
import { LinkPane } from "./LinkPane";
import { Markdown } from "./Markdown";
import { NoteActions } from "./NoteActions";
import { NoteEditor } from "./NoteEditor";
import { NoteMeta } from "./NoteMeta";

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
  /** Writes a new body to the open note; only reachable while the daemon answers. */
  onSave: (content: string) => Promise<Note>;
  /** Each rejects with the daemon's sentence, which the actions panel shows. */
  onRename: (title: string) => Promise<void>;
  onMove: (toFolder: string) => Promise<void>;
  onDelete: () => Promise<void>;
  /** The header's own edits: the tag list as a whole, and the status. */
  onTags: (tags: string[]) => Promise<void>;
  onStatus: (status: string) => Promise<void>;
}

export function NoteViewer({
  note,
  connection,
  backlinks,
  onOpenNote,
  onSave,
  onRename,
  onMove,
  onDelete,
  onTags,
  onStatus,
}: Props) {
  // The file being edited rather than a boolean: opening another note closes the editor instead of
  // presenting its body inside a draft that belongs to the note before it.
  const [editing, setEditing] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);

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
  const isEditing = editing === note.file;

  return (
    <main className="fade-in flex flex-1 flex-col overflow-hidden">
      <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0">
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
        </div>
        {isEditing ? null : (
          <span className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setActionsOpen((open) => !open)}
              aria-expanded={actionsOpen}
              aria-label="Note actions"
              disabled={connection !== "daemon"}
              title={connection === "daemon" ? undefined : "File changes need the daemon"}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              &middot;&middot;&middot;
            </button>
            <button
              type="button"
              onClick={() => {
                setActionsOpen(false);
                setEditing(note.file);
              }}
              disabled={connection !== "daemon"}
              title={connection === "daemon" ? undefined : "Editing needs the daemon"}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              Edit
            </button>
          </span>
        )}
      </header>
      <NoteMeta
        // A fresh field per file, so a half-typed tag never lands on the note opened next.
        // The prefix keeps this key to itself: these three children all reset on the same file,
        // and one shared key made React warn about duplicates in this list.
        key={`meta-${note.file}`}
        note={note}
        canEdit={connection === "daemon"}
        onTags={onTags}
        onStatus={onStatus}
      />
      {!isEditing && actionsOpen ? (
        <NoteActions
          // A fresh panel per file, so a rename draft never lands on the note opened after it.
          key={`actions-${note.file}`}
          note={note}
          linkedFrom={backlinks.length}
          onRename={onRename}
          onMove={onMove}
          onDelete={onDelete}
          onClose={() => setActionsOpen(false)}
        />
      ) : null}
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
      {isEditing ? (
        <NoteEditor
          // A fresh draft per file: the key is what stops one note's text landing in another.
          key={`editor-${note.file}`}
          note={note}
          onSave={onSave}
          onSaved={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      ) : null}
      {!isEditing && backlinks.length > 0 ? (
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
      {!isEditing && link ? <LinkPane url={link} connection={connection} /> : null}
      {isEditing ? null : (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {note.content.trim() ? (
            <Markdown source={note.content} />
          ) : (
            <p className="text-sm text-muted-foreground">This note is empty.</p>
          )}
        </div>
      )}
    </main>
  );
}
