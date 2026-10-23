import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { Folder, GraphData, Note, VaultEntry } from "@lumos/shared";
import {
  createNote,
  deleteNote,
  getFolders,
  getGraph,
  getNote,
  getNotes,
  moveNote,
  renameNote,
  restoreNote,
  saveNote,
  updateNoteMeta,
  type Connection,
  type FolderCount,
} from "./lib/api";
import { backlinks } from "@lumos/vault-utils/graph";
import { DEMO_FOLDERS, DEMO_GRAPH, DEMO_NOTES, demoNote } from "./lib/demo";
import { countTags, filterEntries, nodeTag } from "./lib/filter";
import { isTypingTarget, stepForKey, stepIndex } from "./lib/list-nav";
import { PANE_DEFAULT, clampPaneWidth } from "./lib/pane-size";
import { recentEntries, rememberRecent } from "./lib/recent";
import { NoteList, keyOf } from "./components/NoteList";
import { NoteViewer } from "./components/NoteViewer";
import { PaneBoundary } from "./components/PaneBoundary";
import { PaneSplitter } from "./components/PaneSplitter";
import { SearchModal } from "./components/SearchModal";
import { Sidebar, type FolderFilter, type ShellView } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";

// The graph renderer is a 184 kB chunk that only its own tab needs, so it loads with the tab.
const GraphView = lazy(() =>
  import("./components/GraphView").then((module) => ({ default: module.GraphView })),
);

/** The filename at the end of a note's absolute path, which is the key the list knows it by. */
function nameOf(file: string): string {
  return file.split(/[\\/]/).pop() ?? "";
}

/** The key a note is addressed by, as the daemon answered it. */
function keyOfNote(note: Note): string {
  return `${note.folder}/${nameOf(note.file)}`;
}

/** Why something failed, in the words the status bar has room for. */
function reasonOf(err: unknown): string {
  return err instanceof Error ? err.message : "unknown error";
}

export default function App() {
  const [connection, setConnection] = useState<Connection>("connecting");
  const [folders, setFolders] = useState<FolderCount[]>([]);
  const [notes, setNotes] = useState<VaultEntry[]>([]);
  const [activeFolder, setActiveFolder] = useState<FolderFilter>("All");
  const [query, setQuery] = useState("");
  // A tag filter outlives a folder change on purpose; it is switched off explicitly.
  const [tag, setTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [fetched, setFetched] = useState<{ key: string; note: Note } | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ShellView>("notes");
  // Null means the daemon could not serve a graph, so the demo vault is drawn instead.
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // Keys of the notes opened this session, for the palette's empty state. A reload starts empty.
  const [recent, setRecent] = useState<string[]>([]);
  // The list's width lives here, not in NoteList: the Graph tab unmounts the list, and a width that
  // reset every time someone looked at the graph would be worse than no splitter at all.
  const [listWidth, setListWidth] = useState(PANE_DEFAULT);
  // Something the daemon did or could not do, said in the status bar. Never a silent failure.
  // An undo rides with the notice that offers it, so a later notice cannot leave a stale button behind.
  const [notice, setNotice] = useState<{
    text: string;
    undo?: { id: string; title: string };
  } | null>(null);

  // Load the vault from the daemon; fall back to demo data if it is not running.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [f, n] = await Promise.all([getFolders(), getNotes()]);
        if (!alive) return;
        setFolders(f);
        setNotes(n);
        setConnection("daemon");
      } catch {
        if (!alive) return;
        setFolders(DEMO_FOLDERS);
        setNotes(DEMO_NOTES);
        setConnection("demo");
      } finally {
        if (alive) setLoading(false);
      }
      // The graph is a separate read: notes still work if it fails.
      try {
        const g = await getGraph();
        if (alive) setGraph(g);
      } catch {
        if (alive) setGraph(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Folder and query decide which tags are on offer; the tag then narrows that same set, so a
  // count is always a count of what is actually listed.
  const scoped = useMemo(
    () => filterEntries(notes, { folder: activeFolder, query, tag: null }),
    [notes, activeFolder, query],
  );

  const visible = useMemo(
    () => filterEntries(scoped, { folder: "All", query: "", tag }),
    [scoped, tag],
  );

  const tagCounts = useMemo(() => countTags(scoped), [scoped]);

  // The active note key is derived from the list and the user's choice - never repaired in an effect.
  const activeKey = useMemo(() => {
    if (selected && visible.some((n) => keyOf(n) === selected)) return selected;
    return visible.length > 0 ? keyOf(visible[0]) : null;
  }, [selected, visible]);

  const activeEntry = useMemo(
    () => (activeKey ? (notes.find((n) => keyOf(n) === activeKey) ?? null) : null),
    [activeKey, notes],
  );

  // The graph already knows every link, so the viewer's backlinks need no second request. Offline it
  // is the demo graph, whose ids match the demo notes; a real note simply has none.
  const linkedFrom = useMemo(
    () => (activeKey ? backlinks(graph ?? DEMO_GRAPH, activeKey) : []),
    [graph, activeKey],
  );

  // Fetch the full note from the daemon (async only - the demo path needs no effect).
  useEffect(() => {
    if (connection !== "daemon" || !activeKey || !activeEntry) return;
    let alive = true;
    getNote(activeEntry.folder, activeEntry.name)
      .then((n) => {
        if (alive) setFetched({ key: activeKey, note: n });
      })
      .catch(() => {
        // Keep the listing excerpt as the fallback content.
      });
    return () => {
      alive = false;
    };
  }, [connection, activeKey, activeEntry]);

  // Derived at render: demo note, or the fetched note once it matches the active key.
  const note = useMemo(() => {
    if (!activeEntry) return null;
    if (connection !== "daemon") return demoNote(activeEntry);
    return fetched && fetched.key === activeKey ? fetched.note : demoNote(activeEntry);
  }, [activeEntry, connection, fetched, activeKey]);

  // Every way of picking a note runs through here, so "recent" means what was opened, from the
  // list, a graph node or the palette alike - and every route updates the history the same way.
  const chooseNote = useCallback((key: string): void => {
    setSelected(key);
    setRecent((keys) => rememberRecent(keys, key));
  }, []);

  // Opening a node clears the list filters, so the note really becomes the active one.
  const openNote = useCallback(
    (id: string): void => {
      setActiveFolder("All");
      setQuery("");
      setTag(null);
      chooseNote(id);
      setView("notes");
    },
    [chooseNote],
  );

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  /**
   * Save a new body into the note that was open, then re-read what the save may have changed.
   *
   * The body can change the note's title, its tags and its links, so the listing, the graph and the
   * folder counts are all refreshed rather than patched by guesswork. The save itself has already
   * landed by then: a refresh that fails is reported as a notice and not as a failed save.
   */
  const saveActiveNote = useCallback(
    async (content: string): Promise<Note> => {
      if (!activeEntry || !activeKey) throw new Error("There is no note open to save.");
      const saved = await saveNote(activeEntry.folder, activeEntry.name, content);
      setFetched({ key: activeKey, note: saved });
      setNotice(null);
      try {
        const [notesAfter, graphAfter, foldersAfter] = await Promise.all([
          getNotes(),
          getGraph(),
          getFolders(),
        ]);
        setNotes(notesAfter);
        setGraph(graphAfter);
        setFolders(foldersAfter);
      } catch (err: unknown) {
        setNotice({ text: `Saved, but the list could not be refreshed (${reasonOf(err)}).` });
      }
      return saved;
    },
    [activeEntry, activeKey],
  );

  /**
   * Re-read what a file operation may have changed.
   *
   * A rename or a move changes a note's key, its folder, the folder counts and every link and tag
   * edge the graph drew from it, so the three reads happen again rather than being patched. The
   * operation itself has already landed by then: a refresh that fails is a notice, not a failed
   * change.
   */
  const refreshVault = useCallback(async (): Promise<void> => {
    const [notesAfter, foldersAfter, graphAfter] = await Promise.all([
      getNotes(),
      getFolders(),
      getGraph(),
    ]);
    setNotes(notesAfter);
    setFolders(foldersAfter);
    setGraph(graphAfter);
  }, []);

  /**
   * Rename the open note, then open it under its new name.
   *
   * The answer is shown straight away rather than after the re-read, so the title in the header
   * follows the rename instead of lagging behind it. The filters stay as they were: a rename is
   * not a change of subject. Other notes' links are rewritten by the daemon, so the status bar says
   * how many followed - a cascade the user did not see happen would be the one surprising part.
   */
  const renameActiveNote = useCallback(
    async (title: string): Promise<void> => {
      if (!activeEntry) throw new Error("There is no note open to rename.");
      const { note: renamed, updated } = await renameNote(
        activeEntry.folder,
        activeEntry.name,
        title,
      );
      const key = keyOfNote(renamed);
      setFetched({ key, note: renamed });
      setNotice(
        updated.length === 0
          ? null
          : {
              text: `Renamed; ${updated.length} ${updated.length === 1 ? "note links" : "notes link"} to the new title.`,
            },
      );
      try {
        await refreshVault();
      } catch (err: unknown) {
        setNotice({ text: `Renamed, but the list could not be refreshed (${reasonOf(err)}).` });
      }
      chooseNote(key);
    },
    [activeEntry, chooseNote, refreshVault],
  );

  /**
   * Move the open note into another folder and keep it open.
   *
   * The list switches to every folder, because the folder filter the user was looking through
   * would otherwise hide the note they just moved there.
   */
  const moveActiveNote = useCallback(
    async (toFolder: string): Promise<void> => {
      if (!activeEntry) throw new Error("There is no note open to move.");
      const moved = await moveNote(activeEntry.folder, activeEntry.name, toFolder);
      const key = keyOfNote(moved);
      setFetched({ key, note: moved });
      setNotice(null);
      try {
        await refreshVault();
      } catch (err: unknown) {
        setNotice({ text: `Moved, but the list could not be refreshed (${reasonOf(err)}).` });
      }
      openNote(key);
    },
    [activeEntry, openNote, refreshVault],
  );

  /**
   * Change the open note's tags or status, then re-read what that changed.
   *
   * A tag is a chip in the list and a node in the graph, so the listing, the folder counts and the
   * graph are all read again rather than patched. The edit has already landed by then: a refresh
   * that fails is a status-bar notice, not a failed change.
   */
  const editActiveMeta = useCallback(
    async (patch: { tags?: string[]; status?: string }): Promise<void> => {
      if (!activeEntry) throw new Error("There is no note open.");
      const updated = await updateNoteMeta(activeEntry.folder, activeEntry.name, patch);
      setFetched({ key: keyOfNote(updated), note: updated });
      try {
        await refreshVault();
      } catch (err: unknown) {
        setNotice({ text: `Changed, but the list could not be refreshed (${reasonOf(err)}).` });
      }
    },
    [activeEntry, refreshVault],
  );

  /**
   * Delete the open note. The selection is dropped, so the next note in the list takes over.
   *
   * The daemon moves the file to the vault's trash rather than removing it, so the entry it answers
   * is kept: the status bar offers an undo until it is dismissed or another delete replaces it.
   */
  const deleteActiveNote = useCallback(async (): Promise<void> => {
    if (!activeEntry) throw new Error("There is no note open to delete.");
    const deleted = activeEntry.title;
    const { id } = await deleteNote(activeEntry.folder, activeEntry.name);
    const undo = { id, title: deleted };
    setSelected(null);
    setFetched(null);
    setNotice({ text: `Deleted "${deleted}".`, undo });
    try {
      await refreshVault();
    } catch (err: unknown) {
      setNotice({
        text: `Deleted "${deleted}", but the list could not be refreshed (${reasonOf(err)}).`,
        undo,
      });
    }
  }, [activeEntry, refreshVault]);

  /** Put back what the last delete moved to the trash, and open it again where it was. */
  const undoDelete = useCallback(
    async (id: string, title: string): Promise<void> => {
      setNotice(null);
      try {
        const note = await restoreNote(id);
        await refreshVault();
        openNote(keyOfNote(note));
        setNotice({ text: `Restored "${title}".` });
      } catch (err: unknown) {
        setNotice({ text: `"${title}" could not be restored (${reasonOf(err)}).` });
      }
    },
    [refreshVault, openNote],
  );

  const resizeList = useCallback((width: number): void => setListWidth(clampPaneWidth(width)), []);

  /**
   * Write a new note, then re-read the vault and open what was just written.
   *
   * The listing, the folder counts and the graph are all re-read rather than patched: the note is
   * new, and the graph may have gained an edge or a tag node from its body. Opening it by the key
   * the daemon answers is what makes "created" feel like a result rather than a submission.
   */
  const createNoteAndOpen = useCallback(
    async (folder: Folder, text: string): Promise<Note> => {
      const created = await createNote(folder, text);
      setNotice(null);
      try {
        const [notesAfter, foldersAfter, graphAfter] = await Promise.all([
          getNotes(),
          getFolders(),
          getGraph(),
        ]);
        setNotes(notesAfter);
        setFolders(foldersAfter);
        setGraph(graphAfter);
        openNote(keyOfNote(created));
      } catch (err: unknown) {
        setNotice({ text: `Created, but the list could not be refreshed (${reasonOf(err)}).` });
      }
      return created;
    },
    [openNote],
  );

  // `j`/`k` walk the visible list, but never while a field has focus (where they are letters) or
  // while the palette is open (where they belong to the query).
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (searchOpen || view !== "notes" || loading) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const delta = stepForKey(event.key);
      if (delta === null || visible.length === 0) return;
      event.preventDefault();
      const index = visible.findIndex((n) => keyOf(n) === activeKey);
      chooseNote(keyOf(visible[stepIndex(index, delta, visible.length)]));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, view, loading, visible, activeKey, chooseNote]);

  // The palette opens from anywhere, including while a note is scrolled or a field has focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setSearchOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openFromSearch = useCallback(
    (key: string): void => {
      openNote(key);
      setSearchOpen(false);
    },
    [openNote],
  );

  // Resolved against the live listing, so a note that left the vault is not offered again.
  const recentNotes = useMemo(() => recentEntries(recent, notes), [recent, notes]);

  /** A tag picked in the list or on a graph node shows that tag's notes and drops the rest. */
  const filterByTag = (value: string): void => {
    setTag(nodeTag(value) ?? value);
    setActiveFolder("All");
    setQuery("");
    setView("notes");
  };

  // The undo rides with its notice, so it is offered exactly as long as that notice is showing.
  const pendingUndo = notice?.undo;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          folders={folders}
          total={notes.length}
          active={activeFolder}
          onSelect={setActiveFolder}
          view={view}
          onView={setView}
        />
        {view === "graph" ? (
          <PaneBoundary title="The graph view">
            <Suspense
              fallback={
                <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Loading the graph…
                </p>
              }
            >
              <GraphView
                data={graph ?? DEMO_GRAPH}
                source={graph ? "live" : "demo"}
                connection={connection}
                loading={loading}
                activeKey={activeKey}
                onOpen={openNote}
                onFilterTag={filterByTag}
              />
            </Suspense>
          </PaneBoundary>
        ) : (
          <>
            <NoteList
              notes={visible}
              selected={activeKey}
              query={query}
              onQuery={setQuery}
              onSelect={chooseNote}
              tag={tag}
              onTag={setTag}
              tagCounts={tagCounts}
              loading={loading}
              width={listWidth}
              onCreate={createNoteAndOpen}
              canCreate={connection === "daemon"}
              activeFolder={activeFolder}
            />
            <PaneSplitter width={listWidth} onWidth={resizeList} />
            <NoteViewer
              note={note}
              connection={connection}
              backlinks={linkedFrom}
              onOpenNote={openNote}
              onSave={saveActiveNote}
              onRename={renameActiveNote}
              onMove={moveActiveNote}
              onDelete={deleteActiveNote}
              onTags={(tags) => editActiveMeta({ tags })}
              onStatus={(status) => editActiveMeta({ status })}
            />
          </>
        )}
      </div>
      <StatusBar
        connection={connection}
        count={visible.length}
        onSearch={() => setSearchOpen(true)}
        notice={notice?.text ?? null}
        onDismissNotice={() => setNotice(null)}
        action={
          pendingUndo
            ? {
                label: "Undo",
                onClick: () => void undoDelete(pendingUndo.id, pendingUndo.title),
              }
            : null
        }
      />
      {searchOpen ? (
        <SearchModal
          entries={notes}
          recent={recentNotes}
          connection={connection}
          onOpen={openFromSearch}
          onClose={closeSearch}
        />
      ) : null}
    </div>
  );
}
