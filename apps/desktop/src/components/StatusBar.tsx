import type { Connection } from "../lib/api";
import { SEARCH_SHORTCUT } from "../lib/search";

const LABEL: Record<Connection, string> = {
  connecting: "Connecting to daemon…",
  daemon: "Connected to daemon",
  demo: "Daemon offline — showing demo notes",
};

const DOT: Record<Connection, string> = {
  connecting: "bg-amber-400",
  daemon: "bg-emerald-400",
  demo: "bg-zinc-500",
};

export function StatusBar({
  connection,
  count,
  onSearch,
}: {
  connection: Connection;
  count: number;
  onSearch: () => void;
}) {
  return (
    <footer className="flex shrink-0 items-center justify-between border-t border-border px-4 py-1 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-2">
        <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[connection]}`} />
        {LABEL[connection]}
      </span>
      <span className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSearch}
          aria-keyshortcuts="Control+K Meta+K"
          className="flex items-center gap-1.5 rounded border border-border px-1.5 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
        >
          Search
          <kbd className="text-[10px] opacity-70">{SEARCH_SHORTCUT}</kbd>
        </button>
        <span className="tabular-nums">
          {count} {count === 1 ? "note" : "notes"}
        </span>
      </span>
    </footer>
  );
}
