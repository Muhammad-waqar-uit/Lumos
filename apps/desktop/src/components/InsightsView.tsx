import { useMemo } from "react";
import type { GraphData, VaultEntry } from "@lumos/shared";
import { INSIGHT_ROWS, vaultInsights } from "@lumos/vault-utils/insights";
import type { Connection } from "../lib/api";

interface Props {
  notes: VaultEntry[];
  /**
   * The demo graph while the daemon is out, or null when a live graph could not be read. The two
   * cases are not the same thing: demo data is a complete little vault, a failed read is a gap.
   */
  graph: GraphData | null;
  connection: Connection;
  loading: boolean;
  /** Opens the note a row names. */
  onOpen: (id: string) => void;
  /** Narrows the list to a tag, the same handler the chips use. */
  onFilterTag: (tag: string) => void;
  /** Looks at one folder, the same way the sidebar's folder rows do. */
  onFilterFolder: (folder: string) => void;
}

const BUTTON =
  "rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/** One figure, with the label above it. */
function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</dd>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** A short note list: each one opens, because a count nobody can act on is trivia. */
function NoteRows({
  rows,
  empty,
  onOpen,
}: {
  rows: { id: string; label: string; count?: number }[];
  empty: string;
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) return <p className="mt-2 text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-2 space-y-1">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onOpen(row.id)}
            className="flex w-full items-baseline justify-between gap-3 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-accent/50"
          >
            <span className="min-w-0 truncate text-foreground">{row.label}</span>
            {row.count !== undefined ? (
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {row.count} {row.count === 1 ? "link" : "links"}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The vault, counted, in one pane.
 *
 * The list shows a folder at a time and the graph shows the shape without numbers, so neither
 * answers "is this vault actually connected?" - how much of it links, which notes carry the most,
 * which have not been woven in, and what has been added lately. This is that answer, computed from
 * the listing and the graph the shell has already read, so it opens with no request and works with
 * the daemon stopped.
 *
 * Every figure is a way in: a note row opens it, a tag row filters the list to it. A count nobody
 * can act on is trivia, and the point of this pane is the next note to write.
 */
export function InsightsView({
  notes,
  graph,
  connection,
  loading,
  onOpen,
  onFilterTag,
  onFilterFolder,
}: Props) {
  const insights = useMemo(() => vaultInsights(notes, graph), [notes, graph]);

  const source =
    connection === "daemon"
      ? "Live vault"
      : connection === "connecting"
        ? "Connecting to daemon…"
        : "Offline — demo vault";

  return (
    // The grids below answer to the pane, not to the window: the sidebar and the list take ~540px
    // before this pane starts, so a `sm:` rule would ask for three columns in a 300px column.
    <section aria-label="Vault insights" className="fade-in @container flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">Vault insights</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              What the vault holds and how much of it is woven together, counted from the listing
              and the graph this window already has.
            </p>
          </div>
          <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            {source}
          </span>
        </header>

        {loading ? (
          <p className="text-sm text-muted-foreground">Reading the vault…</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The vault is empty. Capture a note and its shape appears here.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-2 @md:grid-cols-3">
              <Stat label="Notes" value={insights.notes} />
              <Stat label="Folders" value={insights.folders} />
              <Stat label="Tags" value={insights.tags} />
              <Stat
                label="Links"
                value={insights.linksKnown ? insights.links : "—"}
                hint={
                  insights.linksKnown
                    ? `${insights.unresolved} unresolved`
                    : "the graph was not readable"
                }
              />
              <Stat
                label="This week"
                value={insights.thisWeek}
                hint={`${insights.thisMonth} this month`}
              />
              <Stat
                label="Not linked"
                value={insights.linksKnown ? insights.orphanCount : "—"}
                hint="no links, no tags"
              />
            </dl>

            {insights.linksKnown ? null : (
              <p
                role="status"
                className="mt-3 rounded-md border border-border bg-card/40 px-3 py-2 text-[11px] text-muted-foreground"
              >
                The link graph could not be read, so links, unresolved targets and the two note
                lists below are left out rather than shown as zero. The graph tab says more.
              </p>
            )}

            <div className="mt-5 grid gap-5 @lg:grid-cols-2">
              <div>
                <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Most linked
                </h3>
                {insights.linksKnown ? (
                  <NoteRows
                    rows={insights.mostLinked}
                    empty="Nothing links to another note yet."
                    onOpen={onOpen}
                  />
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Not read.</p>
                )}
              </div>

              <div>
                <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Not connected yet
                </h3>
                {insights.linksKnown ? (
                  <>
                    <NoteRows
                      rows={insights.orphans}
                      empty="Every note is connected."
                      onOpen={onOpen}
                    />
                    {insights.orphanCount > INSIGHT_ROWS ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        and {insights.orphanCount - INSIGHT_ROWS} more
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">Not read.</p>
                )}
              </div>

              <div>
                <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">Tags</h3>
                {insights.topTags.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    No tags yet. A #hashtag in a captured message becomes one.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {insights.topTags.map((tag) => (
                      <li key={tag.id}>
                        <button
                          type="button"
                          onClick={() => onFilterTag(tag.label)}
                          className={BUTTON}
                          title={`Show the notes tagged ${tag.label}`}
                        >
                          {" "}
                          {tag.label}{" "}
                          <span className="tabular-nums text-muted-foreground">{tag.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Folders
                </h3>
                <ul className="mt-2 space-y-1">
                  {insights.perFolder.map((folder) => (
                    <li key={folder.id}>
                      <button
                        type="button"
                        onClick={() => onFilterFolder(folder.id)}
                        className="flex w-full items-baseline justify-between gap-3 rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-accent/50"
                      >
                        <span className="min-w-0 truncate text-foreground">{folder.label} </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {folder.count}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
