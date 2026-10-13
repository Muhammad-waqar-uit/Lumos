import type { Connection } from "../lib/api";

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

export function StatusBar({ connection, count }: { connection: Connection; count: number }) {
  return (
    <footer className="flex shrink-0 items-center justify-between border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-2">
        <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[connection]}`} />
        {LABEL[connection]}
      </span>
      <span className="tabular-nums">
        {count} {count === 1 ? "note" : "notes"}
      </span>
    </footer>
  );
}
