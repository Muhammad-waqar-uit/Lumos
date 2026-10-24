import { useState } from "react";
import { FOLDERS, type Folder, type Note, type VaultEntry } from "@lumos/shared";
import type { FolderFilter, TagCount } from "../lib/filter";
import { NoteComposer } from "./NoteComposer";

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
  /** Creates a note and answers it; the shell refreshes and opens it. */
  onCreate: (folder: Folder, text: string) => Promise<Note>;
  /** False while the demo vault is shown, because there is nothing behind it to write to. */
  canCreate: boolean;
  /** Where the list is looking, so a new note starts in the folder you are already in. */
  activeFolder: FolderFilter;
  /** The notes chosen for a bulk action, by key (`Folder/name.md`). Omitted = no selecting. */
  selection?: ReadonlySet<string>;
  onToggleSelect?: (key: string) => void;
  onClearSelection?: () => void;
  /** The bulk actions: the list offers them, the shell performs and reports them. */
  onBulkMove?: (toFolder: Folder) => void;
  onBulkTag?: (tag: string) => void;
  onBulkArchive?: () => void;
}

export const keyOf = (n: VaultEntry): string => `${n.folder}/${n.name}`;

const BULK_BUTTON =
  "rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

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
  onCreate,
  canCreate,
  activeFolder,
  selection,
  onToggleSelect,
  onClearSelection,
  onBulkMove,
  onBulkTag,
  onBulkArchive,
}: Props) {
  // Writing a note is done in the list's own pane, so a new note is where you were looking.
  const [composing, setComposing] = useState(false);
  // The tag to add to the selected notes, kept here so the bar types without a round trip.
  const [tagDraft, setTagDraft] = useState("");
  const selectedCount = selection?.size ?? 0;
  // A tag filter can outlive the folder it was set in; keep its chip so it can be switched off.
  const chips: TagCount[] =
    tag !== null && !tagCounts.some((counted) => counted.tag === tag)
      ? [{ tag, count: 0 }, ...tagCounts]
      : tagCounts;

  return (
    <section className="flex shrink-0 flex-col" style={{ width }}>
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2">
          <label htmlFor="note-search" className="sr-only">
            Search notes
          </label>
          <input
            id="note-search"
            type="search"
            value={query}
            onChange={(e) => onQuery(e.currentTarget.value)}
            placeholder="Search notes"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setComposing((open) => !open)}
            disabled={!canCreate}
            title={canCreate ? undefined : "Creating a note needs the daemon"}
            className="shrink-0 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {composing ? "Close" : "New"}
          </button>
        </div>
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
      {composing ? (
        <NoteComposer
          // "All notes" is not a folder anything can be filed into, so a new note starts in Inbox.
          initialFolder={activeFolder === "All" ? "Inbox" : activeFolder}
          onCreate={onCreate}
          onCreated={() => setComposing(false)}
          onCancel={() => setComposing(false)}
        />
      ) : null}
      {selectedCount > 0 && onBulkMove && onBulkTag && onBulkArchive && onClearSelection ? (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 text-xs"
        >
          <span className="tabular-nums text-muted-foreground">{selectedCount} selected</span>
          <select
            aria-label="Move selected notes to"
            value=""
            onChange={(e) => {
              if (e.currentTarget.value) onBulkMove(e.currentTarget.value as Folder);
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
          >
            <option value="">Move to…</option>
            {FOLDERS.map((folder) => (
              <option key={folder} value={folder}>
                {folder}
              </option>
            ))}
          </select>
          <input
            aria-label="Tag to add to the selected notes"
            placeholder="Tag…"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagDraft.trim()) {
                onBulkTag(tagDraft.trim());
                setTagDraft("");
              }
            }}
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-ring"
          />
          <button
            type="button"
            disabled={!tagDraft.trim()}
            onClick={() => {
              onBulkTag(tagDraft.trim());
              setTagDraft("");
            }}
            className={BULK_BUTTON + " disabled:opacity-50"}
          >
            Add tag
          </button>
          <button type="button" onClick={onBulkArchive} className={BULK_BUTTON}>
            Archive
          </button>
          <button type="button" onClick={onClearSelection} className={BULK_BUTTON}>
            Clear
          </button>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto">
        {composing ? null : loading ? (
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
                    <div className="flex items-start gap-2 px-4 pt-3">
                      {onToggleSelect ? (
                        <input
                          type="checkbox"
                          aria-label={`Select ${n.title}`}
                          checked={selection?.has(key) ?? false}
                          onChange={() => onToggleSelect(key)}
                          className="mt-1 size-3.5 shrink-0 accent-brand"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onSelect(key)}
                        aria-current={isActive ? "true" : undefined}
                        className="block min-w-0 flex-1 text-left"
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
                    </div>
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
