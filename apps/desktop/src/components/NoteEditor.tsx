import { useRef, useState } from "react";
import type { Note } from "@lumos/shared";

interface Props {
  note: Note;
  /** Saves the body and answers the note as the vault now reads. Rejecting keeps the draft. */
  onSave: (content: string) => Promise<Note>;
  onSaved: (note: Note) => void;
  onCancel: () => void;
}

/**
 * The body as a plain textarea.
 *
 * Markdown is edited as text on purpose: the vault is the file, and a rendered editor would have to
 * round-trip syntax the user did not write. A failed save keeps the draft and says why - losing
 * typing to a daemon that is down would be the one unforgivable outcome here.
 */
export function NoteEditor({ note, onSave, onSaved, onCancel }: Props) {
  const [draft, setDraft] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = draft !== note.content;
  // What the textarea holds now, readable from a save that is still in flight: that closure belongs
  // to the render it started in and cannot see typing that came after it.
  const latest = useRef(draft);

  const save = async (): Promise<void> => {
    if (saving) return;
    const sent = draft;
    setSaving(true);
    setError(null);
    try {
      const saved = await onSave(sent);
      // Typing while the request was out is not thrown away by the answer: the editor stays open,
      // with the newer text, and the user saves again.
      if (latest.current === sent) onSaved(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That note could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-2">
        <p className="truncate text-[11px] text-muted-foreground">
          Editing the body. The frontmatter is left as it is.
          {dirty ? <span className="ml-2 text-amber-400">Unsaved changes</span> : null}
        </p>
        {error ? (
          <p role="alert" className="truncate text-[11px] text-red-400" title={error}>
            {error}
          </p>
        ) : null}
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-md border border-border bg-accent px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-accent/80 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </span>
      </div>
      <textarea
        aria-label="Note body"
        value={draft}
        onChange={(event) => {
          latest.current = event.target.value;
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          const saveChord = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s";
          if (saveChord) {
            event.preventDefault();
            void save();
            return;
          }
          // Escape cannot close the editor while a save is out: the answer is still coming, and a
          // request whose editor disappeared has nowhere to report a failure.
          if (event.key === "Escape" && !saving) {
            event.preventDefault();
            onCancel();
          }
        }}
        spellCheck
        className="flex-1 resize-none bg-transparent px-6 py-5 font-mono text-[13px] leading-relaxed text-foreground focus:outline-none"
      />
    </div>
  );
}
