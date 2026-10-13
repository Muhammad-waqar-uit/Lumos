import type { Folder } from "@lumos/shared";
import type { FolderCount } from "../lib/api";

export type FolderFilter = Folder | "All";

interface Props {
  folders: FolderCount[];
  total: number;
  active: FolderFilter;
  onSelect: (folder: FolderFilter) => void;
}

export function Sidebar({ folders, total, active, onSelect }: Props) {
  const items: { key: FolderFilter; label: string; count: number }[] = [
    { key: "All", label: "All notes", count: total },
    ...folders.map((f) => ({ key: f.folder as FolderFilter, label: f.folder, count: f.count })),
  ];

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="px-4 py-3.5">
        <h1 className="text-sm font-semibold tracking-wide">Lumos</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">Second brain</p>
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
    </aside>
  );
}
