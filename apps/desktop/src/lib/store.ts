import { create } from "zustand";
import type { GraphData, VaultEntry } from "@lumos/shared";
import { getFolders, getGraph, getNotes, type Connection, type FolderCount } from "./api";
import { DEMO_FOLDERS, DEMO_NOTES } from "./demo";
import type { FolderFilter } from "./filter";

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
  activeFolder: FolderFilter;
  query: string;
  /** A tag filter outlives a folder change on purpose; it is switched off explicitly. */
  tag: string | null;
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
}

export const useVaultStore = create<VaultState>((set) => ({
  connection: "connecting",
  loading: true,
  folders: [],
  notes: [],
  graph: null,
  activeFolder: "All",
  query: "",
  tag: null,

  /** Load the vault from the daemon; fall back to demo data if it is not running. */
  loadVault: async () => {
    try {
      const [folders, notes] = await Promise.all([getFolders(), getNotes()]);
      set({ folders, notes, connection: "daemon" });
    } catch {
      set({ folders: DEMO_FOLDERS, notes: DEMO_NOTES, connection: "demo" });
    } finally {
      set({ loading: false });
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
}));
