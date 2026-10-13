import type { Note } from "@lumos/shared";

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

export function NoteViewer({ note }: { note: Note | null }) {
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
            <a href={fm.url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              {fm.url}
            </a>
          ) : null}
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {note.content.trim() ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
            {note.content}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">This note is empty.</p>
        )}
      </div>
    </main>
  );
}
