import { useMemo, useState } from "react";
import type { VaultEntry } from "@lumos/shared";
import { activityYears, vaultActivity } from "@lumos/vault-utils/profile";
import type { Connection } from "../lib/api";
import {
  BIO_MAX,
  NAME_MAX,
  PIN_LIMIT,
  README_MAX,
  USERNAME_MAX,
  normalizeUsername,
  profileInitial,
  useProfileStore,
} from "../lib/profile";
import { Markdown } from "./Markdown";

/**
 * The profile: who this vault belongs to, what they pinned to the top of it, and when they wrote.
 *
 * The list shows one folder at a time and the stats pane counts what is there now; neither says
 * when the writing happened. This is the calendar view of the vault - a square for each day, the
 * streaks that make it worth reading, and the handful of notes worth keeping in reach. It counts
 * the listing the shell already holds, so it opens with no request and works with the daemon
 * stopped.
 *
 * The name, the line under it and the pins are preferences rather than notes, so they live in
 * `localStorage` (see `lib/profile.ts`) and the pane is fully usable offline.
 */

const QUIET =
  "rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50";
const FIELD =
  "w-full rounded-md border border-input bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** One figure with its label, matching the stats pane's tiles. */
function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</dd>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** One day's square. Padding days (before January or after December) stay invisible. */
function HeatCell({ day }: { day: { date: string; count: number; level: number | null } }) {
  if (day.level === null) return <span className="size-2.5" aria-hidden />;
  const notes = day.count === 1 ? "1 note" : `${day.count} notes`;
  return (
    <span
      className={`heat-${day.level} size-2.5 rounded-[2px]`}
      title={day.count === 0 ? `No notes on ${day.date}` : `${notes} on ${day.date}`}
    />
  );
}

/** A pinned note, as a card: the note opens, the pin comes off beside it. */
function PinnedCard({
  entry,
  onOpen,
  onUnpin,
}: {
  entry: VaultEntry;
  onOpen: () => void;
  onUnpin: () => void;
}) {
  return (
    <li className="flex flex-col rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 text-left text-sm font-medium text-foreground hover:underline"
        >
          <span className="block truncate">{entry.title}</span>
        </button>
        <button
          type="button"
          onClick={onUnpin}
          aria-label={`Unpin ${entry.title}`}
          title="Unpin"
          className="shrink-0 rounded px-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Unpin
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {entry.folder} · {formatDate(entry.created)}
      </p>
      {entry.excerpt ? (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{entry.excerpt}</p>
      ) : null}
      {entry.tags.length > 0 ? (
        <p className="mt-1.5 flex flex-wrap gap-1">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-border px-1.5 text-[10px] text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </p>
      ) : null}
    </li>
  );
}

export function ProfileView({
  notes,
  connection,
  loading,
  onOpen,
}: {
  notes: VaultEntry[];
  connection: Connection;
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  const name = useProfileStore((state) => state.name);
  const bio = useProfileStore((state) => state.bio);
  const username = useProfileStore((state) => state.username);
  const readme = useProfileStore((state) => state.readme);
  const pins = useProfileStore((state) => state.pins);
  const save = useProfileStore((state) => state.save);
  const saveReadme = useProfileStore((state) => state.saveReadme);
  const togglePin = useProfileStore((state) => state.togglePin);

  const [now] = useState(() => new Date());
  const years = useMemo(() => activityYears(notes, now), [notes, now]);
  const [year, setYear] = useState(() => now.getFullYear());
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftBio, setDraftBio] = useState(bio);
  const [draftUsername, setDraftUsername] = useState(username);
  const [editingReadme, setEditingReadme] = useState(false);
  const [draftReadme, setDraftReadme] = useState(readme);
  const [picking, setPicking] = useState(false);

  // A year picked from the profile outlives a vault that no longer lists it; fall back rather
  // than drawing an empty grid for a year nothing can be said about.
  const shownYear = years.includes(year) ? year : (years[0] ?? now.getFullYear());
  const activity = useMemo(() => vaultActivity(notes, shownYear, now), [notes, shownYear, now]);

  const byId = useMemo(
    () => new Map(notes.map((note) => [`${note.folder}/${note.name}`, note])),
    [notes],
  );
  // A pin to a note that was renamed or deleted is dropped here rather than shown as a card that
  // cannot open; the profile itself keeps it, so a note that comes back is pinned again.
  const pinnedNotes = pins
    .map((id) => byId.get(id))
    .filter((entry): entry is VaultEntry => entry !== undefined);

  const startEditing = (): void => {
    setDraftName(name);
    setDraftBio(bio);
    setDraftUsername(username);
    setEditing(true);
  };

  const submit = (): void => {
    save(draftName, draftBio, draftUsername);
    setEditing(false);
  };

  const startEditingReadme = (): void => {
    setDraftReadme(readme);
    setEditingReadme(true);
  };

  const submitReadme = (): void => {
    saveReadme(draftReadme);
    setEditingReadme(false);
  };

  const source =
    connection === "daemon"
      ? "Live vault"
      : connection === "connecting"
        ? "Connecting to daemon…"
        : "Offline — demo vault";

  const cellSummary =
    activity.activeDays === 0
      ? `No notes were written in ${activity.year}.`
      : `${activity.total} ${activity.total === 1 ? "note" : "notes"} across ${
          activity.activeDays
        } days in ${activity.year}${
          activity.busiest
            ? `, busiest ${activity.busiest.date} with ${activity.busiest.count}`
            : ""
        }.`;

  return (
    <section aria-label="Profile" className="fade-in @container flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className="grid size-14 shrink-0 place-items-center rounded-full border border-brand/40 bg-accent text-xl font-semibold text-brand"
            >
              {profileInitial(name)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-foreground">
                {name || "Your vault"}
              </h2>
              {username ? <p className="text-[11px] text-muted-foreground">@{username}</p> : null}
              <p className="mt-0.5 max-w-lg text-xs text-muted-foreground">
                {bio || "A second brain on your own disk. Nothing leaves the machine."}
              </p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              {source}
            </span>
            {editing ? null : (
              <button type="button" onClick={startEditing} className={QUIET}>
                Edit profile
              </button>
            )}
          </span>
        </header>

        {editing ? (
          <form
            className="mt-4 rounded-lg border border-border bg-card/40 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label htmlFor="profile-name" className="text-[11px] text-muted-foreground">
              Name
            </label>
            <input
              id="profile-name"
              value={draftName}
              onChange={(event) => setDraftName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setEditing(false);
              }}
              maxLength={NAME_MAX}
              placeholder="Your vault"
              autoFocus
              className={FIELD}
            />
            <label
              htmlFor="profile-username"
              className="mt-2 block text-[11px] text-muted-foreground"
            >
              Username (local display name)
            </label>
            <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus-within:border-ring">
              <span aria-hidden>@</span>
              <input
                id="profile-username"
                value={draftUsername}
                onChange={(event) => setDraftUsername(normalizeUsername(event.currentTarget.value))}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setEditing(false);
                }}
                maxLength={USERNAME_MAX}
                placeholder="your-handle"
                className="min-w-0 flex-1 bg-transparent py-1 text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Only shown in this local profile; it is not an account or globally unique username.
            </p>
            <label htmlFor="profile-bio" className="mt-2 block text-[11px] text-muted-foreground">
              One line about it
            </label>
            <textarea
              id="profile-bio"
              value={draftBio}
              onChange={(event) => setDraftBio(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setEditing(false);
              }}
              maxLength={BIO_MAX}
              rows={2}
              placeholder="What this vault is for."
              className={`${FIELD} resize-none`}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              {" "}
              Kept on this machine, like the notes. {draftBio.length}/{BIO_MAX}
            </p>
            <div className="mt-2 flex gap-1.5">
              <button type="submit" className={QUIET}>
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <section
          aria-label="Profile README"
          className="mt-6 rounded-lg border border-border bg-card/30 p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">README</h3>
            {editingReadme ? null : (
              <button type="button" onClick={startEditingReadme} className={QUIET}>
                {readme ? "Edit README" : "Write a README"}
              </button>
            )}
          </div>
          {editingReadme ? (
            <form
              className="mt-3"
              onSubmit={(event) => {
                event.preventDefault();
                submitReadme();
              }}
            >
              <div className="grid gap-3 @md:grid-cols-2">
                <label className="text-[11px] text-muted-foreground">
                  Markdown
                  <textarea
                    aria-label="Profile README Markdown"
                    value={draftReadme}
                    onChange={(event) => setDraftReadme(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setEditingReadme(false);
                    }}
                    maxLength={README_MAX}
                    rows={10}
                    placeholder="## About me — what you're learning, collecting, or working on."
                    className={`${FIELD} mt-1 min-h-40 resize-y font-mono leading-relaxed`}
                  />
                  <span className="mt-1 block text-[10px]">
                    {draftReadme.length}/{README_MAX}
                  </span>
                </label>
                <div>
                  <p className="text-[11px] text-muted-foreground">Preview</p>
                  <div className="markdown mt-1 min-h-40 rounded-md border border-border bg-background p-3">
                    {draftReadme.trim() ? (
                      <Markdown source={draftReadme} />
                    ) : (
                      <p className="text-xs text-muted-foreground">Nothing to preview yet.</p>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Saved on this machine with your profile. {README_MAX.toLocaleString()} character
                limit.
              </p>
              <div className="mt-2 flex gap-1.5">
                <button type="submit" className={QUIET}>
                  Save README
                </button>
                <button
                  type="button"
                  onClick={() => setEditingReadme(false)}
                  className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : readme.trim() ? (
            <div className="markdown mt-3 border-t border-border pt-3">
              <Markdown source={readme} />
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Add a short Markdown introduction, just like a profile README. It stays in this app on
              this machine.
            </p>
          )}
        </section>

        <div className="mt-6 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Pinned</h3>
          <button
            type="button"
            onClick={() => setPicking((open) => !open)}
            aria-expanded={picking}
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {picking ? "Done" : "Customize your pins"}
          </button>
        </div>

        {picking ? (
          <div className="mt-2 rounded-lg border border-border bg-card/40">
            <p className="border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
              {pinnedNotes.length} of {PIN_LIMIT} pinned — the newest notes are listed first.
            </p>
            <ul className="max-h-56 overflow-y-auto p-1">
              {notes.slice(0, 50).map((note) => {
                const id = `${note.folder}/${note.name}`;
                const isPinned = pins.includes(id);
                const full = !isPinned && pins.length >= PIN_LIMIT;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => togglePin(id)}
                      disabled={full}
                      aria-pressed={isPinned}
                      title={full ? `Up to ${PIN_LIMIT} pins` : undefined}
                      className="flex w-full items-baseline justify-between gap-3 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-accent/50 disabled:opacity-40"
                    >
                      <span className="min-w-0 truncate text-foreground">{note.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {isPinned ? "Unpin" : "Pin"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {pinnedNotes.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {loading
              ? "Reading the vault…"
              : "Nothing pinned. A note kept here is one click from the profile."}
          </p>
        ) : (
          <ul className="mt-2 grid gap-2 @md:grid-cols-2">
            {pinnedNotes.map((note) => (
              <PinnedCard
                key={`${note.folder}/${note.name}`}
                entry={note}
                onOpen={() => onOpen(`${note.folder}/${note.name}`)}
                onUnpin={() => togglePin(`${note.folder}/${note.name}`)}
              />
            ))}
          </ul>
        )}

        <div className="mt-7 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {activity.total} {activity.total === 1 ? "note" : "notes"} in {activity.year}
          </h3>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Year
            <select
              value={shownYear}
              onChange={(event) => setYear(Number(event.currentTarget.value))}
              className="rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px] text-foreground outline-none focus:border-ring"
            >
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="mt-2 text-sm text-muted-foreground">Reading the vault…</p>
        ) : notes.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            The vault is empty. Capture a note and the calendar starts.
          </p>
        ) : (
          <>
            <div className="mt-2 overflow-x-auto pb-1">
              <div className="inline-flex min-w-full gap-1.5">
                <div className="flex flex-col gap-[3px] pt-[15px] pr-0.5 text-[10px] text-muted-foreground">
                  {activity.weekdayLabels.map((label, index) => (
                    <span key={label} className="h-2.5 leading-[10px]">
                      {index % 2 === 1 ? label : ""}
                    </span>
                  ))}
                </div>
                <div>
                  <div className="relative mb-0.5 h-3.5">
                    {activity.months.map((month) => (
                      <span
                        key={`${month.label}-${month.column}`}
                        className="absolute text-[10px] text-muted-foreground"
                        style={{ left: `${month.column * 13}px` }}
                      >
                        {month.label}
                      </span>
                    ))}
                  </div>
                  <div
                    role="img"
                    aria-label={cellSummary}
                    className="flex gap-[3px]"
                    data-testid="activity-grid"
                  >
                    {activity.weeks.map((week, index) => (
                      <div key={index} className="flex flex-col gap-[3px]">
                        {week.map((day) => (
                          <HeatCell key={day.date} day={day} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              One square per day, counted from the date each note was created.
            </p>
            <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
              Less
              {[0, 1, 2, 3, 4].map((level) => (
                <span key={level} className={`heat-${level} size-2.5 rounded-[2px]`} aria-hidden />
              ))}
              More
            </div>
          </>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-2 @md:grid-cols-4">
          <Stat label="Current streak" value={`${activity.currentStreak}d`} hint="days in a row" />
          <Stat label="Longest streak" value={`${activity.longestStreak}d`} hint="best run yet" />
          <Stat label="Active days" value={activity.activeDays} hint={`in ${activity.year}`} />
          <Stat
            label="Busiest day"
            value={activity.busiest ? activity.busiest.count : "—"}
            hint={activity.busiest ? activity.busiest.date : "nothing yet"}
          />
        </dl>
      </div>
    </section>
  );
}
