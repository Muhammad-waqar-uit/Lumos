import { useState } from "react";
import type { Note } from "@lumos/shared";

/** The statuses the picker offers; a note carrying another one keeps it at the top of the list. */
const STATUSES = ["new", "active", "done", "archived"];

const CHIP =
  "inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground";

interface Props {
  note: Note;
  /** False with the daemon down: a demo note has no file to write the tags into. */
  canEdit: boolean;
  /** Each rejects with the daemon's sentence, which the strip shows instead of guessing. */
  onTags: (tags: string[]) => Promise<void>;
  onStatus: (status: string) => Promise<void>;
}

/**
 * The open note's tags and status, editable in place.
 *
 * Tags are what the filters, the graph and the palette all read, and until now they could only
 * arrive from a WhatsApp hashtag. Each chip can be removed and a tag can be typed, and both send the
 * whole new list rather than a delta, so two quick edits cannot disagree about what the list is. The
 * status is a small picker because its values are a vocabulary, not free text.
 *
 * A write that fails keeps everything on screen: the strip is the only place the reason can be read,
 * and a failed tag must not look like a tag that was saved.
 */
export function NoteMeta({ note, canEdit, onTags, onStatus }: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = note.frontmatter.tags;
  const status = note.frontmatter.status;
  // A hand-written status the picker does not know is kept, rather than silently rewritten.
  const options = STATUSES.includes(status) ? STATUSES : [status, ...STATUSES];

  /** Run one write, and say whether it landed, so the draft is cleared only on success. */
  const run = async (task: () => Promise<void>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await task();
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That change could not be made.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addTag = async (): Promise<void> => {
    const tag = draft.trim().replace(/^#/, "").toLowerCase();
    // An empty field and a tag already on the note are not errors, they are no-ops.
    if (!tag) return;
    if (tags.includes(tag)) {
      setDraft("");
      return;
    }
    if (await run(() => onTags([...tags, tag]))) setDraft("");
  };

  const removeTag = (tag: string): void => {
    void run(() => onTags(tags.filter((candidate) => candidate !== tag)));
  };

  return (
    <section
      aria-label="Tags and status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-6 py-2"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {tags.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">No tags</span>
        ) : (
          tags.map((tag) => (
            <span key={tag} className={CHIP}>
              #{tag}
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  disabled={busy}
                  aria-label={`Remove tag ${tag}`}
                  title={`Remove #${tag}`}
                  className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  ×
                </button>
              ) : null}
            </span>
          ))
        )}
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            void addTag();
          }}
        >
          <label htmlFor="note-add-tag" className="sr-only">
            Add a tag
          </label>
          <input
            id="note-add-tag"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder="Add a tag"
            disabled={!canEdit || busy}
            title={canEdit ? undefined : "Tag changes need the daemon"}
            className="w-24 rounded-md border border-border bg-transparent px-2 py-0.5 text-[11px] outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canEdit || busy || !draft.trim()}
            className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </div>

      <label
        htmlFor="note-status"
        className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground"
      >
        Status
        <select
          id="note-status"
          value={status}
          onChange={(event) => void run(() => onStatus(event.currentTarget.value))}
          disabled={!canEdit || busy}
          title={canEdit ? undefined : "Status changes need the daemon"}
          className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-50"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p role="alert" className="basis-full text-[11px] text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
