import { create } from "zustand";
import type { GraphData, VaultEntry } from "@lumos/shared";
import { getFolders, getGraph, getNotes, type Connection, type FolderCount } from "./api";
import { DEMO_FOLDERS, DEMO_NOTES } from "./demo";
import { diagnoseDaemon, type DaemonDiagnosis } from "./diagnostics";
import type { FolderFilter } from "./filter";
import { localStore, readSort, writeSort, type SortOrder } from "./sort";

/**
 * The vault and where the list is looking: everything the shell reads from the daemon and
 * re-reads after every change. The pane and the open note are deliberately absent - they live
 * in the address (`src/router.tsx`) - and session-only UI state (notices, drafts, the pane
 * widths) stays in the component that owns it.
 */
interface VaultState {
  connection: Connection;
  loading: boolean;
  folders: FolderCount[];
  notes: VaultEntry[];
  /** Null means the daemon could not serve a graph, so the demo vault is drawn instead. */
  graph: GraphData | null;
  /**
   * Why the last read failed, when it did. Null while the daemon answers, which is what keeps a
   * stale reason from being shown beside a working vault.
   */
  diagnosis: DaemonDiagnosis | null;
  activeFolder: FolderFilter;
  query: string;
  /** A tag filter outlives a folder change on purpose; it is switched off explicitly. */
  tag: string | null;
  /** How the listed notes are ordered. Filtering decides which, this decides their order. */
  sort: SortOrder;
  loadVault: () => Promise<void>;
  /**
   * Re-read what a save or a file operation may have changed. It throws on failure rather than
   * reporting anything itself: the caller turns the failure into the status-bar notice, which is
   * the only place in the app that speaks to the person.
   */
  refreshVault: () => Promise<void>;
  setActiveFolder: (folder: FolderFilter) => void;
  setQuery: (query: string) => void;
  setTag: (tag: string | null) => void;
  setSort: (order: SortOrder) => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  connection: "connecting",
  loading: true,
  folders: [],
  notes: [],
  graph: null,
  diagnosis: null,
  activeFolder: "All",
  query: "",
  tag: null,
  sort: readSort(localStore()),

  /** Load the vault from the daemon; fall back to demo data if it is not running. */
  loadVault: async () => {
    try {
      const [folders, notes] = await Promise.all([getFolders(), getNotes()]);
      set({ folders, notes, connection: "daemon", loading: false, diagnosis: null });
    } catch {
      // The panes get something to draw before the probe runs: a diagnosis is worth a request, but
      // a blank window is not worth waiting for one.
      set({ folders: DEMO_FOLDERS, notes: DEMO_NOTES, connection: "demo", loading: false });
      set({ diagnosis: await diagnoseDaemon() });
    }
    // The graph is a separate read: notes still work if it fails.
    try {
      set({ graph: await getGraph() });
    } catch {
      set({ graph: null });
    }
  },

  refreshVault: async () => {
    const [notes, folders, graph] = await Promise.all([getNotes(), getFolders(), getGraph()]);
    set({ notes, folders, graph });
  },

  setActiveFolder: (activeFolder) => set({ activeFolder }),
  setQuery: (query) => set({ query }),
  setTag: (tag) => set({ tag }),
  setSort: (sort) => {
    // Stored before it is applied: a write that fails must not stop the list from reordering.
    writeSort(sort, localStore());
    set({ sort });
  },
}));
