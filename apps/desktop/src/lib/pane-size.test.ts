import { describe, expect, it } from "vitest";
import {
  PANE_DEFAULT,
  PANE_MAX,
  PANE_MIN,
  PANE_STEP,
  clampPaneWidth,
  nudgePaneWidth,
} from "./pane-size";

describe("clampPaneWidth", () => {
  it("keeps a width inside the bounds", () => {
    expect(clampPaneWidth(400)).toBe(400);
  });

  it("stops at the narrowest and widest the list may be", () => {
    expect(clampPaneWidth(10)).toBe(PANE_MIN);
    expect(clampPaneWidth(2_000)).toBe(PANE_MAX);
  });

  it("rounds, so a drag lands on whole pixels", () => {
    expect(clampPaneWidth(320.6)).toBe(321);
    expect(clampPaneWidth(320.4)).toBe(320);
  });

  it("falls back to the default for a value that is not a number", () => {
    expect(clampPaneWidth(Number.NaN)).toBe(PANE_DEFAULT);
    expect(clampPaneWidth(Number.POSITIVE_INFINITY)).toBe(PANE_DEFAULT);
  });
});

describe("nudgePaneWidth", () => {
  it("moves by one step in either direction", () => {
    expect(nudgePaneWidth(400, PANE_STEP)).toBe(416);
    expect(nudgePaneWidth(400, -PANE_STEP)).toBe(384);
  });

  it("cannot be pushed past a bound, however many steps are asked for", () => {
    expect(nudgePaneWidth(PANE_MAX, PANE_STEP)).toBe(PANE_MAX);
    expect(nudgePaneWidth(PANE_MIN, -PANE_STEP)).toBe(PANE_MIN);
    expect(nudgePaneWidth(PANE_MIN - 100, PANE_STEP)).toBe(PANE_MIN + PANE_STEP);
  });

  it("recovers from a width that was never valid", () => {
    expect(nudgePaneWidth(Number.NaN, PANE_STEP)).toBe(PANE_DEFAULT + PANE_STEP);
  });
});
