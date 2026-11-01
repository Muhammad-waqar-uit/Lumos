import { describe, expect, it } from "vitest";
import { QR_CELL_EM, QR_MAX_PX, qrCells, qrFontSizeCss } from "./qr";

describe("qrCells", () => {
  it("counts the widest line and the rows", () => {
    expect(qrCells("█▀█\n▀▀▀")).toEqual({ columns: 3, rows: 2 });
  });

  it("does not count a trailing newline as a row", () => {
    // The daemon's drawing ends with one; counting it would shorten the code by a row's worth.
    expect(qrCells("██\n██\n")).toEqual({ columns: 2, rows: 2 });
  });

  it("takes the widest line, not the first", () => {
    expect(qrCells("█\n████").columns).toBe(4);
  });
});

describe("qrFontSizeCss", () => {
  it("never asks for a size larger than the cap", () => {
    expect(qrFontSizeCss({ columns: 3, rows: 2 })).toContain(`min(${QR_MAX_PX}px`);
  });

  it("divides the card's width by what the columns cost", () => {
    // The number that matters: a 65-module code at 0.6em a column is far too wide for 13px.
    const css = qrFontSizeCss({ columns: 65, rows: 33 });

    expect(css).toContain(`/ ${(65 * QR_CELL_EM).toFixed(2)})`);
    expect(css).toContain("min(22rem, calc(100vw - 2rem))");
  });

  it("also caps the height, so a short window cannot clip it", () => {
    expect(qrFontSizeCss({ columns: 65, rows: 33 })).toContain("100vh");
  });

  it("falls back to the cap for an empty drawing", () => {
    expect(qrFontSizeCss({ columns: 0, rows: 0 })).toBe(`${QR_MAX_PX}px`);
  });
});
