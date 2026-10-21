import type { VaultEntry } from "@lumos/shared";
import type { TagCount } from "../lib/filter";

interface Props {
  notes: VaultEntry[];
  selected: string | null;
  query: string;
  onQuery: (query: string) => void;
  onSelect: (key: string) => void;
  /** The active tag filter, or null when every tag is allowed through. */
  tag: string | null;
  onTag: (tag: string | null) => void;
  /** Tags available in the current folder and query, with how many notes carry each. */
  tagCounts: TagCount[];
  loading: boolean;
  /** Width in pixels, owned by the shell so the splitter and the pane cannot disagree. */
  width: number;
}

export const keyOf = (n: VaultEntry): string => `${n.folder}/${n.name}`;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function NoteList({
  notes,
  selected,
  query,
  onQuery,
  onSelect,
  tag,
  onTag,
  tagCounts,
  loading,
  width,
}: Props) {
  // A tag filter can outlive the folder it was set in; keep its chip so it can be switched off.
  const chips: TagCount[] =
    tag !== null && !tagCounts.some((counted) => counted.tag === tag)
      ? [{ tag, count: 0 }, ...tagCounts]
      : tagCounts;

  return (
    <section className="flex shrink-0 flex-col" style={{ width }}>
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
        {chips.length > 0 ? (
          <div role="group" aria-label="Filter by tag" className="mt-2 flex flex-wrap gap-1">
            {chips.map(({ tag: name, count }) => {
              const active = name === tag;
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onTag(active ? null : name)}
                  className={
                    "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors " +
                    (active
                      ? "border-ring bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                  }
                >
                  #{name}
                  {count > 0 ? <span className="tabular-nums opacity-60">{count}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {tag === null ? "No notes here yet." : `No notes tagged #${tag}.`}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {notes.map((n) => {
              const key = keyOf(n);
              const isActive = key === selected;
              return (
                <li key={key}>
                  <div
                    className={
                      "transition-colors " + (isActive ? "bg-accent" : "hover:bg-accent/40")
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(key)}
                      aria-current={isActive ? "true" : undefined}
                      className="block w-full px-4 pt-3 text-left"
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
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pt-1.5 text-[11px] text-muted-foreground">
                      <span>{n.folder}</span>
                      {n.problems && n.problems.length > 0 ? (
                        <span
                          title={n.problems.join("; ")}
                          className="rounded border border-border px-1 text-foreground"
                        >
                          ! frontmatter
                        </span>
                      ) : null}
                      {n.tags.map((noteTag) => {
                        const isFiltered = noteTag === tag;
                        return (
                          <button
                            key={noteTag}
                            type="button"
                            aria-pressed={isFiltered}
                            onClick={() => onTag(isFiltered ? null : noteTag)}
                            className={
                              "rounded px-1 transition-colors hover:text-foreground " +
                              (isFiltered ? "text-foreground" : "")
                            }
                          >
                            #{noteTag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
