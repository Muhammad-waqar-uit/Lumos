/**
 * Where the graph's nodes and camera were last time.
 *
 * The graph view unmounts whenever the user switches to the notes tab, and force-graph lays a
 * fresh graph out from scratch on construction. Remembering the coordinates outside the component
 * is what lets the next mount resume the layout instead of reshuffling it in front of the user.
 */

/** A coordinate in graph space. */
export interface Point {
  x: number;
  y: number;
}

/** The zoom, plus the graph-space point under the middle of the pane. */
export interface GraphCamera {
  zoom: number;
  center: Point;
}

/** What survives a tab switch: node coordinates, and a view the user placed themselves. */
export interface GraphLayout {
  positions: ReadonlyMap<string, Point>;
  /** Null while the view is the app's own fit, which is redone on the next mount. */
  camera: GraphCamera | null;
}

/** The part of a rendered node this module needs. */
export interface PlacedNode {
  id: string;
  x?: number;
  y?: number;
}

function finite(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** True when a camera is worth restoring; a zoom of zero or NaN would leave the canvas blank. */
export function usableCamera(camera: GraphCamera | null): camera is GraphCamera {
  return (
    camera !== null &&
    Number.isFinite(camera.zoom) &&
    camera.zoom > 0 &&
    finite(camera.center.x) &&
    finite(camera.center.y)
  );
}

/** Merge the coordinates the simulation settled on into the remembered ones. */
export function recordPositions(
  previous: ReadonlyMap<string, Point>,
  nodes: readonly PlacedNode[],
): Map<string, Point> {
  const next = new Map(previous);
  for (const node of nodes) {
    if (finite(node.x) && finite(node.y)) next.set(node.id, { x: node.x, y: node.y });
  }
  return next;
}

/** Drop remembered coordinates for notes the vault no longer has. */
export function prunePositions(
  positions: ReadonlyMap<string, Point>,
  knownIds: Iterable<string>,
): Map<string, Point> {
  const keep = new Set(knownIds);
  const next = new Map<string, Point>();
  for (const [id, point] of positions) {
    if (keep.has(id)) next.set(id, point);
  }
  return next;
}

/**
 * Copy the nodes, handing each the coordinate it had last time. A copy matters: force-graph takes
 * ownership of the objects it is given, and a seeded node keeps its place rather than starting from
 * a random one.
 */
export function seedPositions<T extends { id: string }>(
  nodes: readonly T[],
  positions: ReadonlyMap<string, Point>,
): (T & { x?: number; y?: number })[] {
  return nodes.map((node) => {
    const point = positions.get(node.id);
    return point ? { ...node, x: point.x, y: point.y } : { ...node };
  });
}

let remembered: GraphLayout = { positions: new Map(), camera: null };

/** The layout as last left: empty on a fresh app, populated once the graph has been open. */
export function readLayout(): GraphLayout {
  return remembered;
}

/** Store what the unmounted graph had, replacing the previous layout wholesale. */
export function writeLayout(layout: GraphLayout): void {
  remembered = {
    positions: layout.positions,
    camera: usableCamera(layout.camera) ? layout.camera : null,
  };
}

/** Forget everything. Tests use this so one case cannot leak into the next. */
export function forgetLayout(): void {
  remembered = { positions: new Map(), camera: null };
}
