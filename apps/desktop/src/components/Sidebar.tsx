import { useState } from "react";
import type { FolderCount } from "../lib/api";
import type { FolderFilter } from "../lib/filter";
import { LumosMark } from "./LumosMark";

export type { FolderFilter } from "../lib/filter";
export type ShellView = "notes" | "graph" | "trash";

const VIEWS: { key: ShellView; label: string }[] = [
  { key: "notes", label: "Notes" },
  { key: "graph", label: "Graph" },
  { key: "trash", label: "Trash" },
];

interface Props {
  folders: FolderCount[];
  total: number;
  active: FolderFilter;
  onSelect: (folder: FolderFilter) => void;
  view: ShellView;
  onView: (view: ShellView) => void;
  /** Makes a folder and answers its name. Rejecting keeps the form open with the reason. */
  onCreateFolder?: (name: string) => Promise<string>;
}

export function Sidebar({ folders, total, active, onSelect, view, onView, onCreateFolder }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items: { key: FolderFilter; label: string; count: number }[] = [
    { key: "All", label: "All notes", count: total },
    ...folders.map((f) => ({ key: f.folder as FolderFilter, label: f.folder, count: f.count })),
  ];

  const create = async (): Promise<void> => {
    if (!onCreateFolder || busy || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const folder = await onCreateFolder(name.trim());
      setName("");
      setCreating(false);
      onSelect(folder);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That folder could not be made.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <LumosMark className="size-6 shrink-0 text-brand" />
        <div>
          <h1 className="text-sm font-semibold tracking-wide">Lumos</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Second brain</p>
        </div>
      </div>
      <div className="px-3 pb-3">
        <div
          role="tablist"
          aria-label="View"
          className="flex gap-0.5 rounded-md border border-border p-0.5"
        >
          {VIEWS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={view === option.key}
              onClick={() => onView(option.key)}
              className={
                "flex-1 rounded px-2 py-1 text-xs transition-colors " +
                (view === option.key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <nav aria-label="Folders" className="flex-1 overflow-y-auto px-2 pb-3">
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              aria-current={isActive ? "page" : undefined}
              className={
                "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors " +
                (isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
              }
            >
              <span className="truncate">{item.label}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{item.count}</span>
            </button>
          );
        })}
      </nav>
      {onCreateFolder ? (
        <div className="border-t border-border px-2 py-2">
          {creating ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <label htmlFor="new-folder-name" className="sr-only">
                Folder name
              </label>
              <input
                id="new-folder-name"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setCreating(false);
                    setName("");
                    setError(null);
                  }
                }}
                placeholder="Folder name"
                autoFocus
                disabled={busy}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {busy ? "Making…" : "Make folder"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setName("");
                    setError(null);
                  }}
                  disabled={busy}
                  className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              {error ? <p className="mt-1 text-[11px] text-amber-400">{error}</p> : null}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              + New folder
            </button>
          )}
        </div>
      ) : null}
    </aside>
  );
}
