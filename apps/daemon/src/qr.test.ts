import { beforeEach, describe, expect, it } from "vitest";
import { clearQr, pendingQr, qrToText, setQr } from "./qr";

describe("the pairing code", () => {
  beforeEach(() => clearQr());

  it("holds the code the socket emitted, and forgets it once the phone is linked", () => {
    expect(pendingQr()).toBeNull();

    setQr("2@first");
    expect(pendingQr()).toBe("2@first");

    // A code that rotates replaces the one before it rather than queueing.
    setQr("2@second");
    expect(pendingQr()).toBe("2@second");

    clearQr();
    expect(pendingQr()).toBeNull();
  });

  it("draws the code as text blocks, with no terminal colour codes", () => {
    const text = qrToText("2@abc");

    // Half blocks, one character row per two module rows: the page only needs a monospace font.
    expect(text).toMatch(/[\u2580\u2584\u2588]/);
    expect(text).not.toContain("\u001b[");
  });

  it("draws every line the same width, so the modules stay square", () => {
    const widths = new Set(
      qrToText("2@abc")
        .split("\n")
        .map((line) => line.length),
    );
    expect(widths.size).toBe(1);
  });
});
