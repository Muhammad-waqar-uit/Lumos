import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { Folder, Note, VaultEntry } from "@lumos/shared";
import {
  createFolder,
  createNote,
  deleteNote,
  getNote,
  getTrash,
  moveNote,
  renameNote,
  restoreNote,
  emptyTrash,
  saveNote,
  updateNoteMeta,
} from "./lib/api";
import { bulkNotice, runBulk } from "./lib/bulk";
import { useVaultStore } from "./lib/store";
import { backlinks } from "@lumos/vault-utils/graph";
import { DEMO_GRAPH, demoNote } from "./lib/demo";
import { countTags, filterEntries, nodeTag } from "./lib/filter";
import { isTypingTarget, stepForKey, stepIndex } from "./lib/list-nav";
import { PANE_DEFAULT, clampPaneWidth } from "./lib/pane-size";
import { recentEntries, rememberRecent } from "./lib/recent";
import { NoteList, keyOf } from "./components/NoteList";
import { NoteViewer } from "./components/NoteViewer";
import { PaneBoundary } from "./components/PaneBoundary";
import { PaneSplitter } from "./components/PaneSplitter";
import { SearchModal } from "./components/SearchModal";
import { Sidebar, type ShellView } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { TrashPanel } from "./components/TrashPanel";

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
  // The vault and the list's filters live in the store: they outlive any one component, and every
  // mutation re-reads them through the same action. What is *open* - the pane and the note - is
  // the address (src/router.tsx); session-only UI state stays plain React state.
  const connection = useVaultStore((s) => s.connection);
  const folders = useVaultStore((s) => s.folders);
  const notes = useVaultStore((s) => s.notes);
  const loading = useVaultStore((s) => s.loading);
  // Null means the daemon could not serve a graph, so the demo vault is drawn instead.
  const graph = useVaultStore((s) => s.graph);
  const activeFolder = useVaultStore((s) => s.activeFolder);
  const query = useVaultStore((s) => s.query);
  // A tag filter outlives a folder change on purpose; it is switched off explicitly.
  const tag = useVaultStore((s) => s.tag);
  const setActiveFolder = useVaultStore((s) => s.setActiveFolder);
  const setQuery = useVaultStore((s) => s.setQuery);
  const setTag = useVaultStore((s) => s.setTag);
  const loadVault = useVaultStore((s) => s.loadVault);
  const refreshVault = useVaultStore((s) => s.refreshVault);
  // Where you are - the pane and the open note - is the address, so a reload, the back button and
  // a pasted link all land on the same place. A note key is `Folder/name.md`, exactly as the list
  // addresses it, so the two cannot drift apart.
  const { view = "notes", note: selected } = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const [fetched, setFetched] = useState<{ key: string; note: Note } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // The notes chosen for a bulk action, by the same key the list knows them by.
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
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

  // Load the vault from the daemon; the store falls back to demo data if it is not running.
  useEffect(() => {
    void loadVault();
  }, [loadVault]);

  // Leaving the notes pane drops the selection: a bulk action must not be one pane-switch away
  // from notes the person was no longer looking at.
  const toggleSelect = useCallback((key: string): void => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /**
   * Run one write over the selected notes, then say what happened and re-read the vault.
   *
   * A refusal on one note never abandons the rest (`runBulk` settles every write), and the
   * summary - including the first refusal in the daemon's own words - is the status-bar notice.
   */
  const bulkWrite = useCallback(
    async (action: string, write: (entry: VaultEntry) => Promise<unknown>): Promise<void> => {
      const targets = notes.filter((n) => selection.has(keyOf(n)));
      const summary = await runBulk(targets, write);
      setSelection(new Set());
      setNotice({ text: bulkNotice(action, summary) });
      try {
        await refreshVault();
      } catch (err: unknown) {
        setNotice({
          text: `${action} done, but the list could not be refreshed (${reasonOf(err)}).`,
        });
      }
    },
    [notes, selection, refreshVault],
  );

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

  /** Every view change goes through here, so the address always says which pane is open. */
  const setView = useCallback(
    (next: ShellView): void => {
      // Leaving the notes pane drops the selection: a bulk action must not be one pane-switch
      // away from notes the person was no longer looking at.
      if (next !== "notes") setSelection(new Set());
      // "notes" is the pane a plain address already means, so it is dropped rather than written.
      void navigate({ search: (prev) => ({ ...prev, view: next === "notes" ? undefined : next }) });
    },
    [navigate],
  );

  /** Every way of picking a note runs through here, so "recent" means what was opened, from the
   * list, a graph node or the palette alike - and every route updates the address the same way. */
  const chooseNote = useCallback(
    (key: string): void => {
      void navigate({ search: (prev) => ({ ...prev, note: key }) });
      setRecent((keys) => rememberRecent(keys, key));
    },
    [navigate],
  );

  // Opening a node clears the list filters, so the note really becomes the active one.
  const openNote = useCallback(
    (id: string): void => {
      setActiveFolder("All");
      setQuery("");
      setTag(null);
      // One navigation, not two: the pane and the note change together or not at all.
      void navigate({ search: (prev) => ({ ...prev, note: id, view: undefined }) });
      setRecent((keys) => rememberRecent(keys, id));
    },
    [navigate, setActiveFolder, setQuery, setTag],
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
        await refreshVault();
      } catch (err: unknown) {
        setNotice({ text: `Saved, but the list could not be refreshed (${reasonOf(err)}).` });
      }
      return saved;
    },
    [activeEntry, activeKey, refreshVault],
  );

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
    // The note is out of the vault, so its address is dropped and the next one in the list
    // takes over - a link to a deleted note would only reopen an empty pane.
    void navigate({ search: (prev) => ({ ...prev, note: undefined }) });
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
  }, [activeEntry, navigate, refreshVault]);

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
        await refreshVault();
        openNote(keyOfNote(created));
      } catch (err: unknown) {
        setNotice({ text: `Created, but the list could not be refreshed (${reasonOf(err)}).` });
      }
      return created;
    },
    [openNote, refreshVault],
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

  /**
   * Make a folder, then re-read the vault so it appears in the sidebar and in every menu.
   *
   * The new folder becomes what the list is looking at: making a folder is asking to put something
   * in it, and an empty folder you were not taken to is not an answer. The name comes back so the
   * caller can say what happened.
   */
  const createFolderAndOpen = useCallback(
    async (name: string): Promise<string> => {
      const folder = await createFolder(name);
      try {
        await refreshVault();
      } catch (err: unknown) {
        setNotice({
          text: `Made ${folder}, but the list could not be refreshed (${reasonOf(err)}).`,
        });
      }
      setActiveFolder(folder);
      setView("notes");
      return folder;
    },
    [refreshVault, setActiveFolder, setView],
  );

  // The trash panel is a route like the graph, not a note. Leaving it puts the list back as it was.
  const showNotes = useCallback(() => setView("notes"), [setView]);

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

  // Every folder the vault has, in the order the sidebar lists them. One list feeds the composer,
  // the move menus and the graph legend, so a folder made a moment ago is offered in all of them.
  const folderNames = useMemo(() => folders.map((f) => f.folder), [folders]);

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
          onCreateFolder={connection === "daemon" ? createFolderAndOpen : undefined}
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
                folders={folderNames}
              />
            </Suspense>
          </PaneBoundary>
        ) : view === "trash" ? (
          <PaneBoundary title="The trash">
            <TrashPanel
              onLoad={getTrash}
              onClose={showNotes}
              onRestore={async (id: string, title: string): Promise<void> => {
                const note = await restoreNote(id);
                await refreshVault();
                setNotice({ text: `Restored "${title}".` });
                openNote(keyOfNote(note));
              }}
              onEmpty={async (): Promise<void> => {
                await emptyTrash();
                setNotice({ text: "Trash emptied." });
                await refreshVault();
              }}
            />
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
              folders={folderNames}
              selection={selection}
              onToggleSelect={toggleSelect}
              onClearSelection={() => setSelection(new Set())}
              onBulkMove={(toFolder) =>
                void bulkWrite("Moved", (entry) => moveNote(entry.folder, entry.name, toFolder))
              }
              onBulkTag={(tagToAdd) =>
                void bulkWrite("Tagged", (entry) =>
                  updateNoteMeta(entry.folder, entry.name, {
                    tags: [...new Set([...entry.tags, tagToAdd])],
                  }),
                )
              }
              onBulkArchive={() =>
                void bulkWrite("Archived", (entry) =>
                  updateNoteMeta(entry.folder, entry.name, { status: "archived" }),
                )
              }
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
              folders={folderNames}
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
