import type { VaultEntry } from "@lumos/shared";

/**
 * The vault over the calendar: one square per day, for the profile pane.
 *
 * A listing says what a vault holds and an insights pane says how connected it is, but neither says
 * when the writing happened - whether this is a vault someone returns to or one that was filled in
 * a weekend. This is the arithmetic behind that grid: which day each note was created, banded into
 * four levels, with the streaks that make a graph of squares worth reading.
 *
 * It is pure - the calendar arrives as entries and a `now`, so a suite can pin both - and it counts
 * creation dates only. An edit has no history on disk, so "contributions" here means notes written.
 */

/** How many colour steps a day can have; `0` means nothing was written. */
export const HEAT_LEVELS = 4;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** A day in the grid. `level` is null for the padding that squares the year into whole weeks. */
export interface ActivityDay {
  /** `YYYY-MM-DD`, in local time: the calendar a person reads is their own. */
  date: string;
  count: number;
  level: number | null;
}

/** A month's label and the week column it starts in, so labels sit over the right squares. */
export interface ActivityMonth {
  label: string;
  column: number;
}

/** Everything the profile pane needs to draw one year. */
export interface VaultActivity {
  year: number;
  /** Years worth offering, newest first: every year that holds a note, plus this one. */
  years: number[];
  /** Notes created in `year`. */
  total: number;
  /** Days in `year` with at least one note. */
  activeDays: number;
  /** Week columns, Sunday first, each seven cells; padding days have a null level. */
  weeks: ActivityDay[][];
  months: ActivityMonth[];
  busiest: { date: string; count: number } | null;
  /** Consecutive days up to today, across years - a streak does not restart in January. */
  currentStreak: number;
  /** The longest run of consecutive days anywhere in the vault. */
  longestStreak: number;
  /** Sundays-to-Saturdays labels for the three rows the grid prints. */
  weekdayLabels: readonly string[];
}

/** Local `YYYY-MM-DD`, so a note written at 23:00 lands on the day the person remembers. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** A key back to a local midnight, which is what makes day arithmetic calendar-safe. */
function keyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * How many notes each day holds.
 *
 * A date the vault cannot parse is skipped rather than counted as today: a hand-edited frontmatter
 * is a fact about one file, not about the calendar.
 */
export function notesPerDay(entries: VaultEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const at = Date.parse(entry.created);
    if (!Number.isFinite(at)) continue;
    const key = dayKey(new Date(at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Every year that holds a note, newest first, always including `now`'s year. */
export function activityYears(entries: VaultEntry[], now: Date = new Date()): number[] {
  const years = new Set<number>([now.getFullYear()]);
  for (const key of notesPerDay(entries).keys()) years.add(keyToDate(key).getFullYear());
  return [...years].sort((a, b) => b - a);
}

/** Midnight `offset` days from `date`, by calendar rather than by milliseconds.
 *
 * A day is not always 24 hours (daylight saving), so every step here goes through the date
 * constructor: adding a day's milliseconds would otherwise repeat or skip a calendar day twice a
 * year, and a heatmap that loses a square is hard to trust.
 */
function plusDays(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

/** The run of consecutive days ending at `end` (or at the day before it), counting backwards. */
function streakToDays(days: Set<string>, end: Date): number {
  let cursor = plusDays(end, 0);
  // Today is not over, so a run that stopped yesterday is still alive; it is only broken once a
  // whole day has passed without a note.
  if (!days.has(dayKey(cursor))) cursor = plusDays(cursor, -1);
  let run = 0;
  while (days.has(dayKey(cursor))) {
    run += 1;
    cursor = plusDays(cursor, -1);
  }
  return run;
}

/** The longest run of consecutive calendar days anywhere in the vault. */
function longestRun(days: Set<string>): number {
  let best = 0;
  for (const key of days) {
    // Only start counting from the first day of a run, so the work is linear in the days held.
    if (days.has(dayKey(plusDays(keyToDate(key), -1)))) continue;
    let run = 0;
    let cursor = keyToDate(key);
    while (days.has(dayKey(cursor))) {
      run += 1;
      cursor = plusDays(cursor, 1);
    }
    best = Math.max(best, run);
  }
  return best;
}

/**
 * The colour step for a day's count, banded absolutely rather than against the year's peak.
 *
 * Relative banding paints the same picture for a vault of one-note days and a vault of twenty-note
 * days - every square at the top step once the busiest day is scaled to it. Four fixed bands say
 * what the day actually held: one note, two, three or four, five and up.
 */
function levelFor(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return HEAT_LEVELS;
}

/**
 * One year of the vault's calendar, as weeks for the grid to draw.
 *
 * The year is padded to whole weeks so every column is seven cells tall; a padding cell keeps its
 * date for a tooltip but has no level, and the pane does not paint it.
 */
export function vaultActivity(
  entries: VaultEntry[],
  year: number,
  now: Date = new Date(),
): VaultActivity {
  const counts = notesPerDay(entries);

  const first = new Date(year, 0, 1);
  const last = new Date(year, 11, 31);
  // Sunday-first, the arrangement the grid is read in.
  const lead = first.getDay();

  const cells: ActivityDay[] = [];
  for (let index = 0; index < lead; index += 1) {
    cells.push({ date: dayKey(plusDays(first, index - lead)), count: 0, level: null });
  }

  let total = 0;
  let activeDays = 0;
  let busiest: { date: string; count: number } | null = null;
  const daysInYear: ActivityDay[] = [];
  for (let offset = 0; ; offset += 1) {
    const date = plusDays(first, offset);
    if (date > last) break;
    const key = dayKey(date);
    const count = counts.get(key) ?? 0;
    total += count;
    if (count > 0) {
      activeDays += 1;
      if (!busiest || count > busiest.count) busiest = { date: key, count };
    }
    daysInYear.push({ date: key, count, level: 0 });
  }

  for (const day of daysInYear) day.level = levelFor(day.count);
  cells.push(...daysInYear);

  // Trailing padding so the final column is a whole week.
  while (cells.length % 7 !== 0) {
    cells.push({ date: dayKey(plusDays(last, cells.length % 7)), count: 0, level: null });
  }

  const weeks: ActivityDay[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));

  // One label per month, on the column its first day falls in, and never two on one column: a
  // month that starts in the same week as the last one is dropped rather than overprinted.
  const months: ActivityMonth[] = [];
  const monthColumns = new Set<number>();
  for (let month = 0; month < 12; month += 1) {
    const offset = Math.round((new Date(year, month, 1).getTime() - first.getTime()) / DAY_MS);
    const column = Math.floor((lead + offset) / 7);
    if (monthColumns.has(column)) continue;
    monthColumns.add(column);
    months.push({ label: MONTH_NAMES[month], column });
  }

  const activeKeys = new Set([...counts.keys()]);

  return {
    year,
    years: activityYears(entries, now),
    total,
    activeDays,
    weeks,
    months,
    busiest,
    currentStreak: streakToDays(activeKeys, now),
    longestStreak: longestRun(activeKeys),
    weekdayLabels: WEEKDAY_NAMES,
  };
}
