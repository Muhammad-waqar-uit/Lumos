import type { VaultEntry } from "@lumos/shared";
import { describe, expect, it } from "vitest";
import { activityYears, HEAT_LEVELS, notesPerDay, vaultActivity } from "./profile";

/**
 * A note created at a local noon, so the day it lands on does not depend on the machine's timezone
 * being east or west of UTC. `month` is 0-based, as `Date` is.
 */
function entry(day: string, hour = 12): VaultEntry {
  const [year, month, date] = day.split("-").map(Number);
  return {
    title: "a note",
    folder: "Inbox",
    file: `Inbox/${day}.md`,
    name: `${day}.md`,
    created: new Date(year, month - 1, date, hour).toISOString(),
    tags: [],
    excerpt: "",
  };
}

/** A fixed "today", so the calendar under test does not move with the real clock. */
const NOW = new Date(2026, 9, 27, 18, 0, 0);

describe("notesPerDay", () => {
  it("counts notes per calendar day, and skips a date it cannot parse", () => {
    const counts = notesPerDay([
      entry("2026-03-04"),
      entry("2026-03-04"),
      entry("2026-03-05"),
      { ...entry("2026-03-06"), created: "not a date" },
    ]);

    expect(counts.get("2026-03-04")).toBe(2);
    expect(counts.get("2026-03-05")).toBe(1);
    expect(counts).toHaveLength(2);
  });

  it("counts a late-night note on the day it was written, not the UTC one", () => {
    // 23:30 local is the next day in UTC east of Greenwich; the calendar a person reads is local.
    expect(notesPerDay([entry("2026-03-04", 23)]).get("2026-03-04")).toBe(1);
  });
});

describe("vaultActivity", () => {
  it("draws a whole year as columns of seven, padded to whole weeks", () => {
    const activity = vaultActivity([], 2026, NOW);

    // 2026 starts on a Thursday, so the first column carries four padding days (Sunday first).
    expect(activity.weeks[0]).toHaveLength(7);
    expect(activity.weeks[0].filter((day) => day.level === null)).toHaveLength(4);
    expect(activity.weeks[0][4]?.date).toBe("2026-01-01");
    for (const week of activity.weeks) expect(week).toHaveLength(7);
    // Every day of the year is present exactly once, and the padding is not.
    expect(activity.weeks.flat().filter((day) => day.level !== null)).toHaveLength(365);
  });

  it("counts the year's notes and bands each day by what it held", () => {
    const activity = vaultActivity(
      [
        entry("2026-02-01"),
        entry("2026-02-01"),
        entry("2026-02-01"),
        entry("2026-02-01"),
        entry("2026-02-02"),
        entry("2026-02-02"),
        entry("2026-05-05"),
      ],
      2026,
      NOW,
    );

    expect(activity.total).toBe(7);
    expect(activity.activeDays).toBe(3);
    expect(activity.busiest).toEqual({ date: "2026-02-01", count: 4 });

    // Bands are absolute, so four notes is the third step whether or not anything busier exists:
    // scaling to the peak would paint a vault of one-note days as brightly as a busy one.
    const levels = new Map(activity.weeks.flat().map((day) => [day.date, day.level]));
    expect(levels.get("2026-02-01")).toBe(3);
    expect(levels.get("2026-02-02")).toBe(2);
    expect(levels.get("2026-05-05")).toBe(1);
    expect(levels.get("2026-02-03")).toBe(0);
  });

  it("reserves the top step for five notes in a day", () => {
    const busy = vaultActivity(
      [entry("2026-03-01"), entry("2026-03-01"), entry("2026-03-01"), entry("2026-03-01")],
      2026,
      NOW,
    );
    expect(busy.weeks.flat().find((day) => day.date === "2026-03-01")?.level).toBe(3);

    const busier = vaultActivity(
      Array.from({ length: 5 }, () => entry("2026-03-01")),
      2026,
      NOW,
    );
    expect(busier.weeks.flat().find((day) => day.date === "2026-03-01")?.level).toBe(HEAT_LEVELS);
  });

  it("labels each month once, on the column its first day falls in", () => {
    const activity = vaultActivity([], 2026, NOW);

    expect(activity.months[0]).toEqual({ label: "Jan", column: 0 });
    // February starts on a Sunday five weeks after the column January is labelled on.
    expect(activity.months.find((month) => month.label === "Feb")?.column).toBe(5);
    // No two labels share a column, so none is overprinted.
    const columns = activity.months.map((month) => month.column);
    expect(new Set(columns).size).toBe(columns.length);
  });

  it("counts a streak across the year boundary and through today", () => {
    const activity = vaultActivity(
      [
        entry("2026-10-25"),
        entry("2026-10-26"),
        entry("2026-10-27"),
        entry("2025-12-30"),
        entry("2025-12-31"),
        entry("2026-01-01"),
      ],
      2026,
      NOW,
    );

    expect(activity.currentStreak).toBe(3);
    expect(activity.longestStreak).toBe(3);
  });

  it("keeps a streak alive for the whole of the day after it was last fed", () => {
    // Nothing written today, everything up to yesterday: the run is not broken until a day passes.
    const activity = vaultActivity([entry("2026-10-25"), entry("2026-10-26")], 2026, NOW);
    expect(activity.currentStreak).toBe(2);

    // Two idle days is a broken run.
    expect(vaultActivity([entry("2026-10-24"), entry("2026-10-25")], 2026, NOW).currentStreak).toBe(
      0,
    );
  });

  it("offers every year that holds a note, newest first, plus this one", () => {
    const entries = [entry("2024-06-01"), entry("2025-01-02"), entry("2026-10-01")];
    expect(activityYears(entries, NOW)).toEqual([2026, 2025, 2024]);
    // A vault with nothing in this year still offers it, so the pane has something to show.
    expect(activityYears([entry("2024-06-01")], NOW)).toEqual([2026, 2024]);
  });

  it("answers an empty vault with an empty but complete year", () => {
    const activity = vaultActivity([], 2026, NOW);
    expect(activity.total).toBe(0);
    expect(activity.activeDays).toBe(0);
    expect(activity.busiest).toBeNull();
    expect(activity.currentStreak).toBe(0);
    expect(activity.weeks.flat().every((day) => day.level === 0 || day.level === null)).toBe(true);
  });
});
