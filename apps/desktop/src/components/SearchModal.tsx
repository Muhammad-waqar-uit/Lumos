import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { VaultEntry } from "@lumos/shared";
import { searchNotes, type Connection } from "../lib/api";
import {
  keyOfEntry,
  makeSearchIndex,
  SEARCH_SHORTCUT,
  searchVault,
  type SearchResult,
} from "../lib/search";

interface Props {
  /** Every loaded note, not the filtered list: the modal searches the whole vault. */
  entries: readonly VaultEntry[];
  /** Notes opened this session, newest first, shown while the field is empty. */
  recent: readonly VaultEntry[];
  connection: Connection;
  onOpen: (key: string) => void;
  onClose: () => void;
}

/** One shared empty list, so "no body search yet" does not invalidate the results memo each render. */
const NO_MATCHES: VaultEntry[] = [];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The `Cmd/Ctrl+K` palette: fuzzy matches over the loaded notes, plus the daemon's body search when
 * it is running. It never needs the daemon to list a note — the local index answers first.
 */
export function SearchModal({ entries, recent, connection, onOpen, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // The answer is stamped with the query it answered, so a stale one is never shown under new text.
  const [answered, setAnswered] = useState<{
    query: string;
    matches: VaultEntry[];
    state: "ok" | "error";
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const trimmed = query.trim();
  const wantsBodies = connection === "daemon" && trimmed.length >= 2;
  const body = wantsBodies && answered && answered.query === trimmed ? answered : null;
  const bodyMatches = body?.matches ?? NO_MATCHES;
  const bodyState: "idle" | "loading" | "ok" | "error" = !wantsBodies
    ? "idle"
    : body
      ? body.state
      : "loading";

  const typed = trimmed.length > 0;
  const index = useMemo(() => makeSearchIndex(entries), [entries]);
  // With nothing typed the palette offers the session's recent notes, in the same result shape, so
  // the arrow keys, Enter and Esc work there without a second code path.
  const results = useMemo<SearchResult[]>(() => {
    if (!typed) return recent.map((entry) => ({ entry, body: false }));
    return searchVault(index, query, bodyMatches);
  }, [typed, recent, index, query, bodyMatches]);

  // Clamped at render, so a shorter result list cannot leave the selection past its end.
  const current = Math.min(active, Math.max(results.length - 1, 0));

  // Focus the field on open and hand focus back to whatever had it when the modal closes.
  useEffect(() => {
    const previous = document.activeElement;
    inputRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  // Escape closes from anywhere in the modal, not only from the field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The listing holds only an excerpt, so the body needs the daemon. Debounced, and stale answers
  // are dropped by the `alive` flag rather than a request counter.
  useEffect(() => {
    if (!wantsBodies) return;

    let alive = true;
    const timer = window.setTimeout(() => {
      searchNotes(trimmed)
        .then((matches) => {
          if (alive) setAnswered({ query: trimmed, matches, state: "ok" });
        })
        .catch(() => {
          // The local matches are still useful; the footer says the body search failed.
          if (alive) setAnswered({ query: trimmed, matches: [], state: "error" });
        });
    }, 200);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [wantsBodies, trimmed]);

  const open = (result: SearchResult | undefined): void => {
    if (result) onOpen(keyOfEntry(result.entry));
  };

  const onFieldKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(current + 1, results.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      open(results[current]);
    }
  };

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-start justify-center bg-background/80 p-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the vault"
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
      >
        <div className="border-b border-border p-3">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setActive(0);
            }}
            onKeyDown={onFieldKeyDown}
            aria-label="Search the vault"
            placeholder="Search the vault"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
          />
        </div>

        <p className="sr-only" role="status">
          {typed ? `${results.length} ${results.length === 1 ? "note" : "notes"} found` : ""}
        </p>

        <div className="max-h-[50vh] overflow-y-auto">
          {!typed && results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Search titles, tags and previews. Body text needs the daemon.
            </p>
          ) : typed && results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {bodyState === "loading" ? "Searching…" : `No notes match “${trimmed}”.`}
            </p>
          ) : (
            <>
              {!typed ? (
                <p className="px-4 pb-1 pt-3 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Recent
                </p>
              ) : null}
              <ul className="divide-y divide-border">
                {results.map((result, i) => {
                  const { entry } = result;
                  const key = keyOfEntry(entry);
                  const isActive = i === current;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => open(result)}
                        onMouseMove={() => setActive(i)}
                        aria-current={isActive ? "true" : undefined}
                        className={
                          "block w-full px-4 py-2.5 text-left transition-colors " +
                          (isActive ? "bg-accent" : "hover:bg-accent/40")
                        }
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">{entry.title}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatDate(entry.created)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>{entry.folder}</span>
                          {entry.tags.map((tag) => (
                            <span key={tag}>#{tag}</span>
                          ))}
                          {result.body ? (
                            <span className="rounded border border-border px-1">in the body</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground">
          <span>↑↓ move · ↵ open · esc close</span>
          {connection !== "daemon" && typed ? (
            <span>Body search needs the daemon</span>
          ) : bodyState === "loading" ? (
            <span>Searching bodies…</span>
          ) : bodyState === "error" ? (
            <span className="text-amber-400">Body search failed</span>
          ) : (
            <span>{SEARCH_SHORTCUT}</span>
          )}
        </footer>
      </div>
    </div>
  );
}
