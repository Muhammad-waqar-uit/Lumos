import { useEffect, useMemo, useState } from "react";
import type { Note, VaultEntry } from "@lumos/shared";
import { getFolders, getNote, getNotes, type Connection, type FolderCount } from "./lib/api";
import { DEMO_FOLDERS, DEMO_NOTES, demoNote } from "./lib/demo";
import { Sidebar, type FolderFilter } from "./components/Sidebar";
import { NoteList, keyOf } from "./components/NoteList";
import { NoteViewer } from "./components/NoteViewer";
import { StatusBar } from "./components/StatusBar";

export default function App() {
  const [connection, setConnection] = useState<Connection>("connecting");
  const [folders, setFolders] = useState<FolderCount[]>([]);
  const [notes, setNotes] = useState<VaultEntry[]>([]);
  const [activeFolder, setActiveFolder] = useState<FolderFilter>("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

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

  // Keep a valid selection as the folder/search changes.
  useEffect(() => {
    if (visible.length === 0) {
      if (selected !== null) setSelected(null);
      return;
    }
    if (!selected || !visible.some((n) => keyOf(n) === selected)) {
      setSelected(keyOf(visible[0]));
    }
  }, [visible, selected]);

  // Load the full note for the current selection.
  useEffect(() => {
    if (!selected) {
      setNote(null);
      return;
    }
    const entry = notes.find((n) => keyOf(n) === selected);
    if (!entry) {
      setNote(null);
      return;
    }
    let alive = true;
    if (connection === "daemon") {
      getNote(entry.folder, entry.name)
        .then((n) => {
          if (alive) setNote(n);
        })
        .catch(() => {
          if (alive) setNote(demoNote(entry));
        });
    } else {
      setNote(demoNote(entry));
    }
    return () => {
      alive = false;
    };
  }, [selected, notes, connection]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          folders={folders}
          total={notes.length}
          active={activeFolder}
          onSelect={setActiveFolder}
        />
        <NoteList
          notes={visible}
          selected={selected}
          query={query}
          onQuery={setQuery}
          onSelect={setSelected}
          loading={loading}
        />
        <NoteViewer note={note} />
      </div>
      <StatusBar connection={connection} count={visible.length} />
    </div>
  );
}
