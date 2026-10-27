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
import type { ShellView } from "./Sidebar";

/** The panes the palette can jump to: every view except the note list it was opened from. */
type TargetView = Exclude<ShellView, "notes">;

interface Props {
  /** Every loaded note, not the filtered list: the modal searches the whole vault. */
  entries: readonly VaultEntry[];
  /** Notes opened this session, newest first, shown while the field is empty. */
  recent: readonly VaultEntry[];
  connection: Connection;
  onOpen: (key: string) => void;
  onClose: () => void;
  /** Opens the composer. Absent while the demo vault is shown, because nothing could be written. */
  onNewNote?: () => void;
  /** Makes a folder and answers its name; a refusal throws with the daemon's sentence. */
  onCreateFolder?: (name: string) => Promise<string>;
  /** Opens another pane of the shell. Absent when there is nowhere to go. */
  onOpenView?: (view: TargetView) => void;
}

/** What the palette can do besides open a note. */
type ActionId = "note" | "folder" | TargetView;

interface Action {
  id: ActionId;
  label: string;
  /** A few words about what choosing it does, shown to the right of the label. */
  detail: string;
}

/** One row of the palette: a section heading, a command, or a note. */
type Row =
  | { kind: "heading"; label: string }
  | { kind: "action"; action: Action; index: number }
  | { kind: "note"; result: SearchResult; index: number };

/** One shared empty list, so "no body search yet" does not invalidate the results memo each render. */
const NO_MATCHES: VaultEntry[] = [];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function matches(action: Action, query: string): boolean {
  const q = query.toLowerCase();
  return action.label.toLowerCase().includes(q) || action.detail.toLowerCase().includes(q);
}

/**
 * The `Cmd/Ctrl+K` palette: fuzzy matches over the loaded notes, the daemon's body search when it
 * is running, and the commands that would otherwise mean a trip to another part of the app - write
 * a note, make a folder, go to the graph or the trash.
 *
 * The commands are kept few and their words plain. A palette that lists everything is a menu with
 * a text box on top; these are the five things someone reaches for with the keyboard already open.
 */
export function SearchModal({
  entries,
  recent,
  connection,
  onOpen,
  onClose,
  onNewNote,
  onCreateFolder,
  onOpenView,
}: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // The folder being named, when "New folder" was chosen. Empty means the field is a search box.
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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
  const notes = useMemo<SearchResult[]>(() => {
    if (!typed) return recent.map((entry) => ({ entry, body: false }));
    return searchVault(index, query, bodyMatches);
  }, [typed, recent, index, query, bodyMatches]);

  /** The commands this palette can offer, which is decided by what the shell handed it. */
  const actions = useMemo<Action[]>(() => {
    const list: Action[] = [];
    if (onNewNote) list.push({ id: "note", label: "New note", detail: "in the composer" });
    if (onCreateFolder) list.push({ id: "folder", label: "New folder", detail: "name it here" });
    if (onOpenView) {
      list.push(
        { id: "graph", label: "Open the graph", detail: "links and tags" },
        { id: "insights", label: "Open the stats", detail: "the vault counted" },
        { id: "trash", label: "Open the trash", detail: "deleted notes" },
        { id: "profile", label: "Open the profile", detail: "pins and the year in notes" },
      );
    }
    return list;
  }, [onNewNote, onCreateFolder, onOpenView]);

  /**
   * The rows on screen, in the order they are listed, with the index the arrow keys walk.
   *
   * Typing puts matching commands first, because the words that matched them are the words that
   * were typed. An empty field puts the recent notes first and the commands under them: searching
   * is what the palette is for, and a command is one keystroke away from the end of the list.
   */
  const rows = useMemo<Row[]>(() => {
    const matching = typed ? actions.filter((action) => matches(action, trimmed)) : actions;
    const built: Row[] = [];
    let next = 0;

    const pushActions = (list: Action[], heading: string): void => {
      if (list.length === 0) return;
      built.push({ kind: "heading", label: heading });
      for (const action of list) built.push({ kind: "action", action, index: next++ });
    };
    const pushNotes = (heading: string | null): void => {
      if (notes.length === 0) return;
      if (heading) built.push({ kind: "heading", label: heading });
      for (const result of notes) built.push({ kind: "note", result, index: next++ });
    };

    if (typed) {
      pushActions(matching, "Actions");
      pushNotes(null);
    } else {
      pushNotes("Recent");
      pushActions(matching, "Actions");
    }
    return built;
  }, [actions, notes, typed, trimmed]);

  const selectable = useMemo(() => rows.filter((row) => row.kind !== "heading").length, [rows]);
  // Clamped at render, so a shorter result list cannot leave the selection past its end.
  const current = Math.min(active, Math.max(selectable - 1, 0));

  // Focus the field on open and hand focus back to whatever had it when the modal closes.
  useEffect(() => {
    const previous = document.activeElement;
    inputRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  // Escape closes from anywhere in the dialog, and steps back out of naming a folder first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      if (naming) {
        setNaming(false);
        setCreateError(null);
        setDraft("");
        inputRef.current?.focus();
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, naming]);

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

  /** Choosing a command. The folder one hands the field over to a name rather than closing. */
  const run = (action: Action): void => {
    switch (action.id) {
      case "note":
        onNewNote?.();
        onClose();
        return;
      case "folder":
        setNaming(true);
        setDraft("");
        setCreateError(null);
        return;
      case "graph":
        onOpenView?.("graph");
        onClose();
        return;
      case "insights":
        onOpenView?.("insights");
        onClose();
        return;
      case "trash":
        onOpenView?.("trash");
        onClose();
        return;
      case "profile":
        onOpenView?.("profile");
        onClose();
    }
  };

  /** Make the folder the field is naming, and close on success. A refusal keeps the name typed. */
  const createFolder = async (): Promise<void> => {
    const name = draft.trim();
    if (!name || !onCreateFolder || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      await onCreateFolder(name);
      onClose();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "That folder could not be made.");
    } finally {
      setCreating(false);
    }
  };

  const onFieldKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (naming) {
      if (event.key === "Enter") {
        event.preventDefault();
        void createFolder();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(current + 1, selectable - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows.find(
        (candidate) => candidate.kind !== "heading" && candidate.index === current,
      );
      if (!row || row.kind === "heading") return;
      if (row.kind === "action") run(row.action);
      else open(row.result);
    }
  };

  const rowClass = (isActive: boolean): string =>
    "block w-full px-4 py-2.5 text-left transition-colors " +
    (isActive ? "bg-accent" : "hover:bg-accent/40");

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
            value={naming ? draft : query}
            onChange={(event) => {
              if (naming) {
                setDraft(event.currentTarget.value);
                return;
              }
              setQuery(event.currentTarget.value);
              setActive(0);
            }}
            onKeyDown={onFieldKeyDown}
            aria-label={naming ? "Name the new folder" : "Search the vault"}
            placeholder={naming ? "Name the new folder" : "Search the vault"}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
          />
        </div>

        <p className="sr-only" role="status">
          {naming
            ? "Naming a new folder."
            : typed
              ? `${selectable} ${selectable === 1 ? "command or note" : "commands and notes"} found`
              : ""}
        </p>

        <div className="max-h-[50vh] overflow-y-auto">
          {naming ? (
            <div className="p-4">
              <p className="text-sm text-muted-foreground">
                {draft.trim() ? (
                  <>
                    Make <span className="text-foreground">{draft.trim()}</span> and look at it? It
                    appears in the sidebar, and in the menu `/` answers on WhatsApp.
                  </>
                ) : (
                  "A folder is a directory in the vault. Type a name and press Enter."
                )}
              </p>
              {createError ? <p className="mt-2 text-xs text-amber-400">{createError}</p> : null}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {typed
                ? bodyState === "loading"
                  ? "Searching…"
                  : `No notes match “${trimmed}”.`
                : "Search titles, tags and previews. Body text needs the daemon."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => {
                if (row.kind === "heading")
                  return (
                    <li
                      key={`heading-${row.label}`}
                      className="px-4 pb-1 pt-3 text-[11px] uppercase tracking-wide text-muted-foreground"
                    >
                      {row.label}
                    </li>
                  );

                if (row.kind === "action")
                  return (
                    <li key={`action-${row.action.id}`}>
                      <button
                        type="button"
                        onClick={() => run(row.action)}
                        onMouseMove={() => setActive(row.index)}
                        aria-current={row.index === current ? "true" : undefined}
                        className={rowClass(row.index === current)}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">{row.action.label}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {row.action.detail}
                          </span>
                        </span>
                      </button>
                    </li>
                  );

                const { entry } = row.result;
                return (
                  <li key={keyOfEntry(entry)}>
                    <button
                      type="button"
                      onClick={() => open(row.result)}
                      onMouseMove={() => setActive(row.index)}
                      aria-current={row.index === current ? "true" : undefined}
                      className={rowClass(row.index === current)}
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
                        {row.result.body ? (
                          <span className="rounded border border-border px-1">in the body</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground">
          <span>{naming ? "↵ make the folder · esc back" : "↑↓ move · ↵ open · esc close"}</span>
          {naming ? (
            creating ? (
              <span>Making it…</span>
            ) : (
              <span>Folders</span>
            )
          ) : connection !== "daemon" && typed ? (
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
