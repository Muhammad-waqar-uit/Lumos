import { useState } from "react";
import type { Folder, Note } from "@lumos/shared";

type Mode = "menu" | "rename" | "move" | "delete";

interface Props {
  note: Note;
  /** Notes that link here. A rename rewrites their links, which the panel says before it happens. */
  linkedFrom: number;
  /** Every folder the vault has, so the move menu offers a folder made a moment ago. */
  folders: readonly Folder[];
  /** Each rejects with the daemon's sentence, which the panel shows instead of closing. */
  onRename: (title: string) => Promise<void>;
  onMove: (toFolder: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

const BUTTON =
  "rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50";

/**
 * The open note's file operations, in a strip under its header.
 *
 * Every one of them is a file being moved on disk, so each is one press away from a panel that names
 * what it will do - and delete asks before it sends, because a note that leaves the folder is out of
 * sight even when it is recoverable. A failure keeps the panel open with the daemon's own sentence: a
 * rename that was refused because another note holds the name is something the person can act on, and
 * closing on it would hide the reason.
 */
export function NoteActions({
  note,
  linkedFrom,
  folders,
  onRename,
  onMove,
  onDelete,
  onClose,
}: Props) {
  const [mode, setMode] = useState<Mode>("menu");
  const [title, setTitle] = useState(note.title);
  // Moving only offers folders this note is not already in, so the menu cannot ask for a no-op.
  const otherFolders = folders.filter((candidate) => candidate !== note.folder);
  const [folder, setFolder] = useState<Folder>(() => otherFolders[0] ?? note.folder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Run one operation, and close the panel only when it landed.
   *
   * Nothing is reset after a close: the component is about to unmount, and the panel that replaces
   * it belongs to whatever note the shell opened next.
   */
  const run = async (task: () => Promise<void>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That change could not be made.");
      setBusy(false);
      return;
    }
    onClose();
  };

  return (
    <section aria-label="File operations" className="border-b border-border px-6 py-2.5">
      {mode === "menu" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={BUTTON} onClick={() => setMode("rename")}>
            Rename
          </button>
          <button
            type="button"
            className={BUTTON}
            onClick={() => setMode("move")}
            disabled={otherFolders.length === 0}
            title={otherFolders.length === 0 ? "There is no other folder to move it to" : undefined}
          >
            Move
          </button>
          <button
            type="button"
            className={BUTTON + " text-red-400"}
            onClick={() => setMode("delete")}
          >
            Delete
          </button>
          <button type="button" className={BUTTON + " ml-auto"} onClick={onClose}>
            Close
          </button>
        </div>
      ) : null}

      {mode === "rename" ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            void run(() => onRename(title));
          }}
        >
          <label htmlFor="note-rename" className="sr-only">
            New title
          </label>
          <input
            id="note-rename"
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            disabled={busy}
            autoFocus
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          />
          <button type="submit" className={BUTTON} disabled={busy || !title.trim()}>
            {busy ? "Renaming…" : "Rename"}
          </button>
          <button type="button" className={BUTTON} onClick={() => setMode("menu")} disabled={busy}>
            Cancel
          </button>
          <p className="basis-full text-[11px] text-muted-foreground">
            The file is renamed after the title and the note&rsquo;s first heading is rewritten to
            match.
            {linkedFrom > 0
              ? ` ${linkedFrom} ${
                  linkedFrom === 1 ? "note links" : "notes link"
                } here; ${linkedFrom === 1 ? "its link is" : "their links are"} rewritten too.`
              : ""}
          </p>
        </form>
      ) : null}

      {mode === "move" ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => onMove(folder));
          }}
        >
          <label htmlFor="note-move" className="text-[11px] text-muted-foreground">
            Move to
          </label>
          <select
            id="note-move"
            value={folder}
            onChange={(event) => setFolder(event.currentTarget.value as Folder)}
            disabled={busy}
            className="rounded-md border border-input bg-background px-2 py-1 text-[11px] outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          >
            {otherFolders.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
          <button type="submit" className={BUTTON} disabled={busy}>
            {busy ? "Moving…" : "Move"}
          </button>
          <button type="button" className={BUTTON} onClick={() => setMode("menu")} disabled={busy}>
            Cancel
          </button>
          <p className="basis-full text-[11px] text-muted-foreground">
            The note keeps its filename and its body; only the folder changes.
          </p>
        </form>
      ) : null}

      {mode === "delete" ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-[11px] text-foreground">
            Delete &ldquo;{note.title}&rdquo;? The file moves to the vault&rsquo;s trash, and the
            status bar offers an undo.
          </p>
          <button
            type="button"
            className={BUTTON + " text-red-400"}
            onClick={() => void run(onDelete)}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
          <button type="button" className={BUTTON} onClick={() => setMode("menu")} disabled={busy}>
            Cancel
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-[11px] text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
