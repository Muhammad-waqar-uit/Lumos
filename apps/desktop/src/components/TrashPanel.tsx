import { useCallback, useEffect, useState } from "react";
import type { TrashedNote } from "../lib/api";

interface Props {
  /** Read once when the panel opens, so the list is what the trash held at that moment. */
  onLoad: () => Promise<TrashedNote[]>;
  /** Each rejects with the daemon's sentence, which the panel shows instead of closing. */
  onRestore: (id: string, name: string) => Promise<void>;
  onEmpty: () => Promise<void>;
  onClose: () => void;
}

const BUTTON =
  "rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50";

/** A date as the list has room for it: the day, then the time. */
function formatWhen(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The vault's trash, as a strip under the note header.
 *
 * A delete can be undone from the notice that offered it, but that notice is gone the moment
 * another one replaces it, and nothing else showed what a delete had kept. This is the list behind
 * that limit: each entry is restorable, and emptying asks first, because it is the one operation
 * with no undo anywhere in the app.
 *
 * A failure keeps the panel open with the daemon's own sentence. A restore that is refused because
 * the name has been taken again is something the person can act on, and closing on it would hide
 * the reason.
 */
export function TrashPanel({ onLoad, onRestore, onEmpty, onClose }: Props) {
  const [entries, setEntries] = useState<TrashedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Emptying is the one action with no undo, so it is two presses: the button, then the confirm.
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    onLoad()
      .then((listed) => {
        if (alive) setEntries(listed);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "The trash could not be read.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [onLoad]);

  /** Take one entry off the list only once the daemon has confirmed it. */
  const restore = useCallback(
    async (entry: TrashedNote): Promise<void> => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await onRestore(entry.id, entry.name);
        setEntries((current) => current.filter((kept) => kept.id !== entry.id));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "That note could not be restored.");
      } finally {
        setBusy(false);
      }
    },
    [busy, onRestore],
  );

  /** Empty the trash, and close: an empty list is not worth a pane of its own. */
  const empty = useCallback(async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onEmpty();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "The trash could not be emptied.");
      setBusy(false);
    }
  }, [busy, onEmpty, onClose]);

  return (
    <section aria-label="Trash" className="fade-in border-b border-border px-6 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Trash</p>
        <button type="button" onClick={onClose} className={BUTTON}>
          Close
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[11px] text-red-400">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-2 text-xs text-muted-foreground">Reading the trash…</p>
      ) : entries.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">The trash is empty.</p>
      ) : (
        <>
          <ul className="mt-2 space-y-1.5">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs text-foreground">
                    {entry.name.replace(/\.md$/, "")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {entry.folder} · deleted {formatWhen(entry.deleted)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void restore(entry)}
                  disabled={busy}
                  className={BUTTON}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2.5">
            {confirming ? (
              <p className="text-[11px] text-muted-foreground">
                <span className="text-foreground">
                  Permanently remove {entries.length} {entries.length === 1 ? "note" : "notes"}?
                </span>{" "}
                <button
                  type="button"
                  onClick={() => void empty()}
                  disabled={busy}
                  className="rounded-md border border-border px-2 py-0.5 text-red-400 transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {busy ? "Emptying…" : "Yes, remove them"}
                </button>{" "}
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                  className={BUTTON}
                >
                  Keep them
                </button>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={busy}
                className={BUTTON}
              >
                Empty the trash
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
