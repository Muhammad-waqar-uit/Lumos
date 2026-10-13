import type { VaultEntry } from "@lumos/shared";

interface Props {
  notes: VaultEntry[];
  selected: string | null;
  query: string;
  onQuery: (query: string) => void;
  onSelect: (key: string) => void;
  loading: boolean;
}

export const keyOf = (n: VaultEntry): string => `${n.folder}/${n.name}`;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function NoteList({ notes, selected, query, onQuery, onSelect, loading }: Props) {
  return (
    <section className="flex w-80 shrink-0 flex-col border-r border-border">
      <div className="border-b border-border p-3">
        <label htmlFor="note-search" className="sr-only">
          Search notes
        </label>
        <input
          id="note-search"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.currentTarget.value)}
          placeholder="Search notes"
          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No notes here yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {notes.map((n) => {
              const key = keyOf(n);
              const isActive = key === selected;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => onSelect(key)}
                    aria-current={isActive ? "true" : undefined}
                    className={
                      "block w-full px-4 py-3 text-left transition-colors " +
                      (isActive ? "bg-accent" : "hover:bg-accent/40")
                    }
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{n.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDate(n.created)}
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                      {n.excerpt}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      <span>{n.folder}</span>
                      {n.tags.map((t) => (
                        <span key={t}>#{t}</span>
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
