import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { GraphData, Note, VaultEntry } from "@lumos/shared";
import {
  getFolders,
  getGraph,
  getNote,
  getNotes,
  type Connection,
  type FolderCount,
} from "./lib/api";
import { DEMO_FOLDERS, DEMO_GRAPH, DEMO_NOTES, demoNote } from "./lib/demo";
import { NoteList, keyOf } from "./components/NoteList";
import { NoteViewer } from "./components/NoteViewer";
import { PaneBoundary } from "./components/PaneBoundary";
import { Sidebar, type FolderFilter, type ShellView } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";

// The graph renderer is the heaviest dependency in the app, so it loads with the tab.
const GraphView = lazy(() =>
  import("./components/GraphView").then((module) => ({ default: module.GraphView })),
);

export default function App() {
  const [connection, setConnection] = useState<Connection>("connecting");
  const [folders, setFolders] = useState<FolderCount[]>([]);
  const [notes, setNotes] = useState<VaultEntry[]>([]);
  const [activeFolder, setActiveFolder] = useState<FolderFilter>("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [fetched, setFetched] = useState<{ key: string; note: Note } | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ShellView>("notes");
  // Null means the daemon could not serve a graph, so the demo vault is drawn instead.
  const [graph, setGraph] = useState<GraphData | null>(null);

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (activeFolder !== "All" && n.folder !== activeFolder) return false;
      if (!q) return true;
      return `${n.title} ${n.excerpt} ${n.tags.join(" ")}`.toLowerCase().includes(q);
    });
  }, [notes, activeFolder, query]);

  // The active note key is derived from the list and the user's choice - never repaired in an effect.
  const activeKey = useMemo(() => {
    if (selected && visible.some((n) => keyOf(n) === selected)) return selected;
    return visible.length > 0 ? keyOf(visible[0]) : null;
  }, [selected, visible]);

  const activeEntry = useMemo(
    () => (activeKey ? (notes.find((n) => keyOf(n) === activeKey) ?? null) : null),
    [activeKey, notes],
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

  // Opening a node clears the list filters, so the note really becomes the active one.
  const openNote = (id: string): void => {
    setActiveFolder("All");
    setQuery("");
    setSelected(id);
    setView("notes");
  };

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
              onSelect={setSelected}
              loading={loading}
            />
            <NoteViewer note={note} />
          </>
        )}
      </div>
      <StatusBar connection={connection} count={visible.length} />
    </div>
  );
}
