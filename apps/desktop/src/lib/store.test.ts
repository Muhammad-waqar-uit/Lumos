import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultEntry } from "@lumos/shared";
import { useVaultStore } from "./store";
import { DEMO_FOLDERS, DEMO_GRAPH, DEMO_NOTES } from "./demo";

const NOTES: VaultEntry[] = [
  {
    title: "Ship the release",
    folder: "Inbox",
    file: "C:/vault/Inbox/ship-the-release.md",
    name: "ship-the-release.md",
    created: "2026-10-20T08:00:00.000Z",
    tags: [],
    excerpt: "Steps for Friday.",
  },
];

const { getFolders, getNotes, getGraph } = vi.hoisted(() => ({
  getFolders: vi.fn(),
  getNotes: vi.fn(),
  getGraph: vi.fn(),
}));

vi.mock("./api", () => ({ getFolders, getNotes, getGraph }));

/** The slice starts where a fresh app starts, so one test cannot lean on another's reads. */
beforeEach(() => {
  vi.clearAllMocks();
  useVaultStore.setState({
    connection: "connecting",
    loading: true,
    folders: [],
    notes: [],
    graph: null,
    activeFolder: "All",
    query: "",
    tag: null,
  });
});

describe("loadVault", () => {
  it("applies what the daemon answered", async () => {
    getFolders.mockResolvedValueOnce([{ folder: "Inbox", count: 1 }]);
    getNotes.mockResolvedValueOnce(NOTES);
    getGraph.mockResolvedValueOnce({ nodes: [], edges: [], unresolved: [] });

    await useVaultStore.getState().loadVault();

    const state = useVaultStore.getState();
    expect(state.connection).toBe("daemon");
    expect(state.loading).toBe(false);
    expect(state.notes).toEqual(NOTES);
    expect(state.folders).toEqual([{ folder: "Inbox", count: 1 }]);
    expect(state.graph).toEqual({ nodes: [], edges: [], unresolved: [] });
  });

  it("falls back to the demo vault when the reads fail, and says it", async () => {
    getFolders.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    getNotes.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await useVaultStore.getState().loadVault();

    const state = useVaultStore.getState();
    expect(state.connection).toBe("demo");
    expect(state.loading).toBe(false);
    expect(state.notes).toEqual(DEMO_NOTES);
    expect(state.folders).toEqual(DEMO_FOLDERS);
  });

  it("still answers with the notes when only the graph read fails", async () => {
    getFolders.mockResolvedValueOnce([]);
    getNotes.mockResolvedValueOnce(NOTES);
    getGraph.mockRejectedValueOnce(new Error("graph is down"));

    await useVaultStore.getState().loadVault();

    const state = useVaultStore.getState();
    expect(state.connection).toBe("daemon");
    expect(state.notes).toEqual(NOTES);
    expect(state.graph).toBeNull();
  });
});

describe("refreshVault", () => {
  it("re-reads notes, folders and graph", async () => {
    getNotes.mockResolvedValueOnce(NOTES);
    getFolders.mockResolvedValueOnce([]);
    getGraph.mockResolvedValueOnce(DEMO_GRAPH);

    await useVaultStore.getState().refreshVault();

    const state = useVaultStore.getState();
    expect(state.notes).toEqual(NOTES);
    expect(state.graph).toEqual(DEMO_GRAPH);
  });

  it("throws rather than swallowing a failed re-read - the caller turns it into a notice", async () => {
    getNotes.mockResolvedValueOnce(NOTES);
    getFolders.mockResolvedValueOnce([]);
    getGraph.mockRejectedValueOnce(new Error("graph is down"));

    await expect(useVaultStore.getState().refreshVault()).rejects.toThrow("graph is down");
  });
});

describe("the filters", () => {
  it.each([
    ["setActiveFolder", "Ideas"],
    ["setQuery", "release"],
    ["setTag", "health"],
  ] as const)("%s changes its own slice and nothing else", (action, value) => {
    useVaultStore.getState()[action](value as never);
    const state = useVaultStore.getState();
    expect(
      action === "setActiveFolder"
        ? state.activeFolder
        : action === "setQuery"
          ? state.query
          : state.tag,
    ).toBe(value);
    // The other two stay as they were.
    const others = {
      activeFolder: state.activeFolder,
      query: state.query,
      tag: state.tag,
    };
    const expected = {
      activeFolder: "All",
      query: "",
      tag: null,
      [action === "setActiveFolder" ? "activeFolder" : action === "setQuery" ? "query" : "tag"]:
        value,
    };
    expect(others).toEqual(expected);
  });
});
