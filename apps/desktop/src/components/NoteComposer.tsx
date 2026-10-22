import { useRef, useState } from "react";
import { FOLDERS, type Folder, type Note } from "@lumos/shared";

interface Props {
  /** Where the composer starts. The folder the list is showing, or Inbox when it is showing all. */
  initialFolder: Folder;
  /** Creates the note and answers it as the vault now reads it. Rejecting keeps the draft. */
  onCreate: (folder: Folder, text: string) => Promise<Note>;
  onCreated: (note: Note) => void;
  onCancel: () => void;
}

/**
 * A new note: a folder, and whatever is typed. The first line becomes the title, as it does for a
 * WhatsApp capture, so the two paths write the same shape of file.
 *
 * The draft belongs to this composer. A failed create keeps it and says why - typing a paragraph
 * into a form that throws it away when the daemon is down is not a bug, it is a broken promise.
 */
export function NoteComposer({ initialFolder, onCreate, onCreated, onCancel }: Props) {
  const [folder, setFolder] = useState<Folder>(initialFolder);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read by a create that is still in flight, so text typed during it is not lost to the answer.
  const latest = useRef("");
  const blank = draft.trim().length === 0;

  const create = async (): Promise<void> => {
    if (creating || blank) return;
    const sent = draft;
    setCreating(true);
    setError(null);
    try {
      const note = await onCreate(folder, sent);
      if (latest.current === sent) onCreated(note);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That note could not be created.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <form
      className="border-b border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      <label htmlFor="new-note-folder" className="sr-only">
        Folder
      </label>
      <select
        id="new-note-folder"
        value={folder}
        onChange={(event) => setFolder(event.target.value as Folder)}
        className="mb-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
      >
        {FOLDERS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <label htmlFor="new-note-text" className="sr-only">
        Note
      </label>
      <textarea
        id="new-note-text"
        value={draft}
        onChange={(event) => {
          latest.current = event.target.value;
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          // Enter adds a newline as usual; this chord is the one that files the note.
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void create();
          }
          if (event.key === "Escape" && !creating) {
            event.preventDefault();
            onCancel();
          }
        }}
        placeholder="Note"
        autoFocus
        className="min-h-40 w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] leading-relaxed outline-none placeholder:font-sans focus:border-ring focus:ring-1 focus:ring-ring"
      />
      <p className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">
          The first line becomes the title.
          {blank ? null : <span className="ml-2 text-amber-400">Unsaved</span>}
        </span>
        {error ? (
          <span role="alert" className="truncate text-right text-red-400" title={error}>
            {error}
          </span>
        ) : null}
      </p>
      <p className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={creating}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={creating || blank}
          className="rounded-md border border-border bg-accent px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/80 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </p>
    </form>
  );
}
