import { useMemo, useState } from "react";
import type { VaultEntry } from "@lumos/shared";
import { tagIndex } from "@lumos/vault-utils/tags";
import type { Connection } from "../lib/api";

interface Props {
  notes: readonly VaultEntry[];
  connection: Connection;
  loading: boolean;
  /** Narrows the notes list to one tag, through the handler the chips already use. */
  onFilterTag: (tag: string) => void;
}

const CHIP =
  "rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/**
 * Every tag in the vault, with the shape of its use.
 *
 * The list's chips only ever offer the tags of the folder and query on screen, which is the right
 * scope for narrowing a list and the wrong one for finding out what the vault is about. This pane
 * is the other view: each tag's reach, the folders it spans, and the tags that travel with it -
 * every row a way in, because a count nobody can act on is trivia.
 *
 * It is computed from the listing the shell already holds, so it opens with no request and works
 * with the daemon stopped. A demo vault is a real little vault here, the same way it is in Stats.
 */
export function TagsView({ notes, connection, loading, onFilterTag }: Props) {
  const index = useMemo(() => tagIndex(notes), [notes]);
  const [filter, setFilter] = useState("");

  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? index.tags.filter(
        (tag) =>
          tag.tag.includes(needle) ||
          tag.related.some((pair) => pair.tag.includes(needle)) ||
          tag.folders.some((folder) => folder.folder.toLowerCase().includes(needle)),
      )
    : index.tags;

  const source =
    connection === "daemon"
      ? "Live vault"
      : connection === "connecting"
        ? "Connecting to daemon…"
        : "Offline — demo vault";

  return (
    <section aria-label="Tags" className="fade-in @container flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">Tags</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Every tag the vault uses, how far it reaches, and which tags keep company with it.
              Choosing one opens the notes that carry it.
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
            The vault is empty. Tag a note and its tags appear here.
          </p>
        ) : index.distinct === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tags yet. A #hashtag in a captured message becomes one, and the note header can add
            one to any note.
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              <span className="text-foreground">{index.distinct}</span>{" "}
              {index.distinct === 1 ? "tag" : "tags"} in{" "}
              <span className="text-foreground">{index.tagged}</span>{" "}
              {index.tagged === 1 ? "note" : "notes"}
              {index.untagged > 0 ? (
                <>
                  {" · "}
                  <span className="text-foreground">{index.untagged}</span>{" "}
                  {index.untagged === 1 ? "note has" : "notes have"} no tags
                </>
              ) : null}
            </p>

            <label htmlFor="tag-filter" className="sr-only">
              Filter tags
            </label>
            <input
              id="tag-filter"
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.currentTarget.value)}
              placeholder="Filter tags"
              className="mb-4 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
            />

            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags match “{filter.trim()}”.</p>
            ) : (
              <ul className="grid gap-2 @md:grid-cols-2">
                {shown.map((tag) => (
                  <li
                    key={tag.tag}
                    className="rounded-lg border border-border bg-card/40 px-3 py-2"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => onFilterTag(tag.tag)}
                        title={`Show the notes tagged ${tag.tag}`}
                        className="min-w-0 truncate text-sm font-medium text-foreground transition-colors hover:text-brand"
                      >
                        #{tag.tag}
                      </button>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {tag.count} {tag.count === 1 ? "note" : "notes"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      in {tag.folders.map((folder) => folder.folder).join(", ")}
                    </p>
                    {tag.related.length > 0 ? (
                      <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                        <span>with</span>
                        {tag.related.map((pair) => (
                          <button
                            key={pair.tag}
                            type="button"
                            onClick={() => onFilterTag(pair.tag)}
                            title={`${pair.count} ${pair.count === 1 ? "note carries" : "notes carry"} both ${tag.tag} and ${pair.tag}`}
                            className={CHIP}
                          >
                            #{pair.tag} <span className="tabular-nums">{pair.count}</span>
                          </button>
                        ))}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
