/**
 * How big the pairing code can be drawn.
 *
 * The code arrives as text: one character per module across, two modules down, because a half
 * block is the smallest thing a terminal can print. That makes its size computable rather than
 * guessed - the drawing knows how many columns and rows it has - which is the fix for a code that
 * rendered at a fixed 13px and hung out of the card on a scrollbar.
 */

/** A monospace cell is about 0.6em wide, which is what `ch` resolves to. */
export const QR_CELL_EM = 0.6;

/** Each line is two modules tall and is drawn at `leading-[2ch]`, so a row costs 1.2em. */
export const QR_LINE_EM = 1.2;

/** Never larger than this: a small code blown up looks broken, not clearer. */
export const QR_MAX_PX = 13;

/** The card's width, its padding and the drawing's own padding, as CSS lengths. */
const CARD = "min(22rem, calc(100vw - 2rem))";
const CARD_INSET = "3.5rem";

export interface QrCells {
  /** Modules across, one character each. */
  columns: number;
  /** Lines, two modules each. */
  rows: number;
}

/** The drawing's size in cells. A trailing newline is not a row of its own. */
export function qrCells(qr: string): QrCells {
  const lines = qr.replace(/[\r\n]+$/, "").split(/\r?\n/);
  return {
    rows: lines.length,
    columns: lines.reduce((widest, line) => Math.max(widest, line.length), 0),
  };
}

/**
 * A `font-size` that fits the code inside the card, in both directions.
 *
 * Width is the limit that actually bites - a pairing code is 60-odd modules across - so the answer
 * is the card's inner width divided by the columns' cost. The height cap is there for a short
 * window, where a code that fits across would still run past the bottom edge.
 */
export function qrFontSizeCss({ columns, rows }: QrCells): string {
  if (columns <= 0 || rows <= 0) return `${QR_MAX_PX}px`;
  const across = `calc((${CARD} - ${CARD_INSET}) / ${(columns * QR_CELL_EM).toFixed(2)})`;
  const down = `calc((100vh - 20rem) / ${(rows * QR_LINE_EM).toFixed(2)})`;
  return `min(${QR_MAX_PX}px, ${across}, ${down})`;
}
