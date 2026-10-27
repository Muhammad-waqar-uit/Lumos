import { useState } from "react";
import type { FolderCount } from "../lib/api";
import type { FolderFilter } from "../lib/filter";
import { profileInitial, useProfileStore } from "../lib/profile";
import { LumosMark } from "./LumosMark";

export type { FolderFilter } from "../lib/filter";
export type ShellView = "notes" | "graph" | "insights" | "trash" | "profile";

// Four tabs share a 224px sidebar, so the labels are the short word for each pane: the pane
// itself says "Vault insights" at the top.
const VIEWS: { key: ShellView; label: string }[] = [
  { key: "notes", label: "Notes" },
  { key: "graph", label: "Graph" },
  { key: "insights", label: "Stats" },
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
  /**
   * Renames the active folder. Rejecting keeps the form open with the reason, exactly as making
   * one does. Absent while there is no daemon to ask.
   */
  onRenameFolder?: (folder: string, to: string) => Promise<void>;
  /**
   * Removes the active folder, moving its notes to Inbox. Rejecting keeps the question on screen
   * with the reason. Absent while there is no daemon to ask.
   */
  onRemoveFolder?: (folder: string) => Promise<void>;
}

export function Sidebar({
  folders,
  total,
  active,
  onSelect,
  view,
  onView,
  onCreateFolder,
  onRenameFolder,
  onRemoveFolder,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The two folder operations. They act on the folder the list is looking at, which is the only
  // folder a person can mean without saying so - a menu per row would be a control inside a
  // button, and this way the action is always about what is on screen.
  const [renaming, setRenaming] = useState(false);
  const [renameTo, setRenameTo] = useState("");
  const [confirming, setConfirming] = useState(false);
  // The avatar carries the name the profile was given, so it is read here rather than passed in:
  // every pane that can rename it already goes through the same store.
  const profileName = useProfileStore((state) => state.name);

  const items: { key: FolderFilter; label: string; count: number }[] = [
    { key: "All", label: "All notes", count: total },
    ...folders.map((f) => ({ key: f.folder as FolderFilter, label: f.folder, count: f.count })),
  ];

  // "All notes" is a view over the vault, not a folder in it, so there is nothing to rename or
  // remove while it is showing.
  const activeIsFolder = active !== "All";
  const activeCount = folders.find((f) => f.folder === active)?.count ?? 0;

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

  const rename = async (): Promise<void> => {
    if (!onRenameFolder || busy || !renameTo.trim() || !activeIsFolder) return;
    setBusy(true);
    setError(null);
    try {
      await onRenameFolder(active, renameTo.trim());
      setRenaming(false);
      setRenameTo("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That folder could not be renamed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!onRemoveFolder || busy || !activeIsFolder) return;
    setBusy(true);
    setError(null);
    try {
      await onRemoveFolder(active);
      setConfirming(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That folder could not be removed.");
    } finally {
      setBusy(false);
    }
  };

  /** Close whatever folder form is open, and forget the reason it was showing. */
  const closeFolderForms = (): void => {
    setCreating(false);
    setRenaming(false);
    setConfirming(false);
    setName("");
    setRenameTo("");
    setError(null);
  };

  const errorLine = error ? <p className="mt-1 text-[11px] text-amber-400">{error}</p> : null;
  const quietButton =
    "rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50";
  const cancelButton =
    "rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground";

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <LumosMark className="size-6 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold tracking-wide">Lumos</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Second brain</p>
        </div>
        {/*
          The profile rides here rather than in the tablist: four tabs already share 224px, and a
          fifth would truncate every label. The avatar is the one control a person looks for
          anyway, and it carries the name they chose.
        */}
        <button
          type="button"
          onClick={() => onView("profile")}
          aria-label="Profile"
          aria-current={view === "profile" ? "page" : undefined}
          title="Your profile - pins, the year in notes, and your name"
          className={
            "grid size-7 shrink-0 place-items-center rounded-full border text-[11px] font-semibold transition-colors " +
            (view === "profile"
              ? "border-brand/60 bg-accent text-brand"
              : "border-border text-muted-foreground hover:bg-accent hover:text-foreground")
          }
        >
          {profileInitial(profileName)}
        </button>
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
      {onCreateFolder || onRenameFolder || onRemoveFolder ? (
        <div className="border-t border-border px-2 py-2">
          {activeIsFolder && (onRenameFolder || onRemoveFolder) && !renaming && !confirming ? (
            <div className="mb-1.5 flex gap-1.5">
              {onRenameFolder ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setRenameTo(active);
                    setRenaming(true);
                  }}
                  className={quietButton}
                >
                  Rename
                </button>
              ) : null}
              {onRemoveFolder ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setConfirming(true);
                  }}
                  className={quietButton}
                >
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}

          {renaming ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void rename();
              }}
            >
              <label htmlFor="rename-folder-name" className="sr-only">
                New folder name
              </label>
              <input
                id="rename-folder-name"
                value={renameTo}
                onChange={(event) => setRenameTo(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setRenaming(false);
                    setRenameTo("");
                    setError(null);
                  }
                }}
                placeholder="New name"
                autoFocus
                disabled={busy}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              />
              <div className="mt-1.5 flex gap-1.5">
                <button type="submit" disabled={busy || !renameTo.trim()} className={quietButton}>
                  {busy ? "Renaming…" : "Rename folder"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(false);
                    setRenameTo("");
                    setError(null);
                  }}
                  disabled={busy}
                  className={cancelButton}
                >
                  Cancel
                </button>
              </div>
              {errorLine}
            </form>
          ) : null}

          {confirming ? (
            <div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Remove <span className="text-foreground">{active}</span>?{" "}
                {activeCount === 1 ? "Its note moves" : "Its notes move"} to Inbox.
              </p>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={busy}
                  className={quietButton}
                >
                  {busy ? "Removing…" : "Remove"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setError(null);
                  }}
                  disabled={busy}
                  className={cancelButton}
                >
                  Cancel
                </button>
              </div>
              {errorLine}
            </div>
          ) : null}

          {onCreateFolder ? (
            creating ? (
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
                    if (event.key === "Escape") closeFolderForms();
                  }}
                  placeholder="Folder name"
                  autoFocus
                  disabled={busy}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
                />
                <div className="mt-1.5 flex gap-1.5">
                  <button type="submit" disabled={busy || !name.trim()} className={quietButton}>
                    {busy ? "Making…" : "Make folder"}
                  </button>
                  <button
                    type="button"
                    onClick={closeFolderForms}
                    disabled={busy}
                    className={cancelButton}
                  >
                    Cancel
                  </button>
                </div>
                {errorLine}
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCreating(true);
                }}
                className="w-full rounded-md px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              >
                + New folder
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
