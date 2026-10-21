/**
 * How wide the note list may be.
 *
 * The bounds are the whole design: narrower than the minimum and the folder, date and tags stop
 * fitting; wider than the maximum and the note itself is squeezed into a column, which is the pane
 * people actually read. Everything here is pure so the drag and the arrow keys cannot disagree.
 */

/** Narrow enough for the list's own content, wide enough to still show an excerpt. */
export const PANE_MIN = 240;

/** Past this the reader is losing more than the list gains. */
export const PANE_MAX = 560;

/** What a fresh window starts with. */
export const PANE_DEFAULT = 320;

/** One arrow key, and roughly the rhythm of a drag tick. */
export const PANE_STEP = 16;

/** Keep a width inside the bounds, rounded. A non-number falls back to the default rather than 0. */
export function clampPaneWidth(width: number): number {
  if (!Number.isFinite(width)) return PANE_DEFAULT;
  return Math.min(Math.max(Math.round(width), PANE_MIN), PANE_MAX);
}

/** Move a width by a step, clamped. Used by the arrow keys, so one press can never escape the bounds. */
export function nudgePaneWidth(width: number, delta: number): number {
  return clampPaneWidth(clampPaneWidth(width) + delta);
}
