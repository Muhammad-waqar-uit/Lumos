import { beforeEach, describe, expect, it } from "vitest";
import {
  forgetLayout,
  prunePositions,
  readLayout,
  recordPositions,
  seedPositions,
  usableCamera,
  writeLayout,
  type Point,
} from "./graph-layout";

const at = (x: number, y: number): Point => ({ x, y });

describe("recordPositions", () => {
  it("keeps the coordinate the simulation settled on", () => {
    const next = recordPositions(new Map<string, Point>(), [{ id: "a", x: 4, y: 9 }]);
    expect(next.get("a")).toEqual(at(4, 9));
  });

  it("keeps a node this pass did not see, so a depth filter cannot forget it", () => {
    const next = recordPositions(new Map<string, Point>([["b", at(1, 2)]]), [
      { id: "a", x: 4, y: 9 },
    ]);
    expect([...next.keys()].sort()).toEqual(["a", "b"]);
  });

  it("ignores a node the simulation has not placed yet", () => {
    const next = recordPositions(new Map<string, Point>(), [
      { id: "a" },
      { id: "b", x: Number.NaN, y: 1 },
    ]);
    expect(next.size).toBe(0);
  });

  it("returns a new map instead of mutating the one it was given", () => {
    const before = new Map<string, Point>([["a", at(1, 1)]]);
    const next = recordPositions(before, [{ id: "a", x: 5, y: 5 }]);
    expect(before.get("a")).toEqual(at(1, 1));
    expect(next).not.toBe(before);
  });
});

describe("prunePositions", () => {
  it("drops a note the vault no longer has", () => {
    const positions = new Map<string, Point>([
      ["a", at(1, 1)],
      ["gone", at(2, 2)],
    ]);
    expect([...prunePositions(positions, ["a"]).keys()]).toEqual(["a"]);
  });
});

describe("seedPositions", () => {
  it("hands a known node its last coordinate and leaves the rest unplaced", () => {
    const seeded = seedPositions([{ id: "a" }, { id: "b" }], new Map([["a", at(7, 8)]]));
    expect(seeded[0]).toEqual({ id: "a", x: 7, y: 8 });
    // An unknown node gets no coordinates, so force-graph places it itself.
    expect(seeded[1]).toEqual({ id: "b" });
  });

  it("copies the nodes, because the renderer takes ownership of what it is given", () => {
    const nodes = [{ id: "a" }];
    seedPositions(nodes, new Map([["a", at(1, 2)]]));
    expect(nodes[0]).toEqual({ id: "a" });
  });
});

describe("usableCamera", () => {
  it("refuses a camera that would leave the canvas blank", () => {
    expect(usableCamera(null)).toBe(false);
    expect(usableCamera({ zoom: 0, center: at(0, 0) })).toBe(false);
    expect(usableCamera({ zoom: Number.NaN, center: at(0, 0) })).toBe(false);
    expect(usableCamera({ zoom: 1.2, center: at(Number.NaN, 0) })).toBe(false);
  });

  it("accepts a real zoom and centre", () => {
    expect(usableCamera({ zoom: 1.2, center: at(-40, 18) })).toBe(true);
  });
});

describe("the layout store", () => {
  beforeEach(() => forgetLayout());

  it("starts empty, so the first visit fits the graph itself", () => {
    expect(readLayout().positions.size).toBe(0);
    expect(readLayout().camera).toBeNull();
  });

  it("remembers the positions and the camera a tab switch must not lose", () => {
    writeLayout({ positions: new Map([["a", at(1, 2)]]), camera: { zoom: 2, center: at(3, 4) } });
    expect(readLayout().positions.get("a")).toEqual(at(1, 2));
    expect(readLayout().camera).toEqual({ zoom: 2, center: at(3, 4) });
  });

  it("drops an unusable camera on the way in", () => {
    writeLayout({ positions: new Map(), camera: { zoom: 0, center: at(0, 0) } });
    expect(readLayout().camera).toBeNull();
  });
});
