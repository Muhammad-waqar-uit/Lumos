import { describe, expect, it } from "vitest";
import { isTypingTarget, stepForKey, stepIndex } from "./list-nav";

describe("stepIndex", () => {
  it("moves one place in either direction", () => {
    expect(stepIndex(1, 1, 4)).toBe(2);
    expect(stepIndex(1, -1, 4)).toBe(0);
  });

  it("stops at the ends instead of wrapping", () => {
    expect(stepIndex(0, -1, 4)).toBe(0);
    expect(stepIndex(3, 1, 4)).toBe(3);
  });

  it("starts at the near end when nothing is selected", () => {
    expect(stepIndex(-1, 1, 4)).toBe(0);
    expect(stepIndex(-1, -1, 4)).toBe(3);
  });

  it("returns the last note for a stale index and never a number outside the list", () => {
    expect(stepIndex(9, -1, 4)).toBe(3);
    expect(stepIndex(9, 1, 4)).toBe(0);
  });

  it("answers with -1 for an empty list, so no selection is invented", () => {
    expect(stepIndex(-1, 1, 0)).toBe(-1);
    expect(stepIndex(0, -1, 0)).toBe(-1);
  });
});

describe("isTypingTarget", () => {
  it("is true for the controls that take text", () => {
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "textarea" })).toBe(true);
    expect(isTypingTarget({ tagName: "select" })).toBe(true);
    expect(isTypingTarget({ tagName: "div", isContentEditable: true })).toBe(true);
  });

  it("is false for a button, a body and no target at all", () => {
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget({ tagName: "BODY" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe("stepForKey", () => {
  it("only claims j and k", () => {
    expect(stepForKey("j")).toBe(1);
    expect(stepForKey("k")).toBe(-1);
    expect(stepForKey("J")).toBeNull();
    expect(stepForKey("Enter")).toBeNull();
  });
});
