import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph from "force-graph";
import { FOLDERS, type GraphData, type GraphEdge, type GraphNode } from "@lumos/shared";
import { neighborhood } from "@lumos/vault-utils/graph";
import type { Connection } from "../lib/api";
import { folderColor, readGraphPalette } from "../lib/graph-palette";

const TAU = Math.PI * 2;
const LABEL_ZOOM = 1.15;
const DEPTH_MAX = 3;

/**
 * The renderer adds its own positional fields to the objects it is handed, so the
 * payload types carry them as optional. The link endpoints start as ids and become
 * node objects once the simulation resolves them.
 */
type CanvasNode = GraphNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  index?: number;
};
type CanvasLink = {
  source: string | CanvasNode;
  target: string | CanvasNode;
  kind: GraphEdge["kind"];
};
interface CanvasData {
  nodes: CanvasNode[];
  links: CanvasLink[];
}
type GraphInstance = ForceGraph<CanvasNode, CanvasLink>;

function endpointId(end: unknown): string | null {
  if (typeof end === "string" || typeof end === "number") return String(end);
  if (end !== null && typeof end === "object") {
    const id = (end as { id?: string | number }).id;
    if (typeof id === "string" || typeof id === "number") return String(id);
  }
  return null;
}

function endpointNode(end: unknown): CanvasNode | null {
  return end !== null && typeof end === "object" ? (end as CanvasNode) : null;
}

/** Nodes grow with their backlinks, the way Obsidian sizes a note by how many point at it. */
function nodeRadius(node: GraphNode): number {
  if (node.kind === "tag") return 1.8 + Math.min(node.inDegree, 10) * 0.22;
  return 2.6 + Math.sqrt(node.inDegree) * 2.1;
}

const glowCache = new Map<string, HTMLCanvasElement>();

/** A cached radial-gradient sprite: a glow must not cost a gradient per node per frame. */
function glowSprite(color: string, radius: number): HTMLCanvasElement {
  const bucket = Math.max(2, Math.round(radius));
  const key = `${color}|${bucket}`;
  const cached = glowCache.get(key);
  if (cached) return cached;

  const size = bucket * 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const mid = size / 2;
    const gradient = ctx.createRadialGradient(mid, mid, bucket * 0.5, mid, mid, mid);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.4, color);
    gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(mid, mid, mid, 0, TAU);
    ctx.fill();
  }
  glowCache.set(key, canvas);
  return canvas;
}

interface Props {
  data: GraphData;
  /** Whether the graph came from the daemon or from the offline demo vault. */
  source: "live" | "demo";
  connection: Connection;
  loading: boolean;
  /** The note open in the notes view, outlined here so the two views stay in step. */
  activeKey: string | null;
  onOpen: (id: string) => void;
  /** Show the notes carrying a tag in the notes view, so a tag node is also a filter. */
  onFilterTag: (tag: string) => void;
}

export function GraphView({
  data,
  source,
  connection,
  loading,
  activeKey,
  onOpen,
  onFilterTag,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<GraphInstance | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [showTags, setShowTags] = useState(true);
  const [showOrphans, setShowOrphans] = useState(true);
  const [depth, setDepth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const palette = useMemo(() => readGraphPalette(), []);

  // The canvas needs pixel dimensions, which only the DOM knows.
  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const connect = (from: string, to: string): void => {
      const set = map.get(from);
      if (set) set.add(to);
      else map.set(from, new Set([to]));
    };
    for (const edge of data.edges) {
      connect(edge.source, edge.target);
      connect(edge.target, edge.source);
    }
    return map;
  }, [data]);

  const pointerFocus = hovered ?? selected;
  // The local graph centres on the pointer, and otherwise on the note open in the notes view.
  const localFocus = pointerFocus ?? (depth > 0 ? activeKey : null);

  const focusSet = useMemo(() => {
    if (!pointerFocus) return null;
    const set = new Set<string>([pointerFocus]);
    for (const id of adjacency.get(pointerFocus) ?? []) set.add(id);
    return set;
  }, [adjacency, pointerFocus]);

  const visible = useMemo(() => {
    const base = depth > 0 && localFocus ? neighborhood(data, localFocus, depth) : data;
    const nodes = base.nodes.filter(
      (node) => (showTags || node.kind !== "tag") && (showOrphans || !node.orphan),
    );
    const keep = new Set(nodes.map((node) => node.id));
    return {
      nodes,
      edges: base.edges.filter((edge) => keep.has(edge.source) && keep.has(edge.target)),
      unresolved: base.unresolved.filter((link) => keep.has(link.source)),
    };
  }, [data, depth, localFocus, showTags, showOrphans]);

  const radius = useMemo(
    () => new Map(visible.nodes.map((node) => [node.id, nodeRadius(node)])),
    [visible],
  );

  // Fresh copies: the renderer takes ownership of the node and link objects it is given.
  const canvasData = useMemo<CanvasData>(
    () => ({
      nodes: visible.nodes.map((node) => ({ ...node })),
      links: visible.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        kind: edge.kind,
      })),
    }),
    [visible],
  );

  const paintPointerArea = useCallback(
    (node: CanvasNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, (radius.get(String(node.id)) ?? 3) + 3, 0, TAU);
      ctx.fill();
    },
    [radius],
  );

  const paintNode = useCallback(
    (node: CanvasNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const id = String(node.id);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const r = radius.get(id) ?? 3;
      const color = node.kind === "tag" ? palette.tag : folderColor(palette, node.folder);
      const isSelected = id === selected;
      const isHovered = id === hovered;
      const dim = focusSet !== null && !focusSet.has(id);
      // A slow breath on the focused node, so the graph reads as alive rather than frozen.
      const breath = isSelected || isHovered ? 1 + 0.07 * Math.sin(performance.now() / 320) : 1;

      const glow = r * 3.4;
      ctx.globalAlpha = dim ? 0.1 : isSelected || isHovered ? 0.62 : 0.4;
      ctx.drawImage(glowSprite(color, r), x - glow, y - glow, glow * 2, glow * 2);

      ctx.globalAlpha = dim ? 0.32 : 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r * breath, 0, TAU);
      ctx.fill();

      if (isSelected || id === activeKey) {
        ctx.globalAlpha = isSelected ? 0.85 : 0.45;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3 / scale;
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, TAU);
        ctx.stroke();
      }

      if (scale > LABEL_ZOOM || isSelected || isHovered) {
        ctx.globalAlpha = dim ? 0.22 : 0.9;
        ctx.fillStyle = palette.label;
        ctx.font = `${11 / scale}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(node.label, x, y + r + 3);
      }

      ctx.globalAlpha = 1;
    },
    [radius, palette, selected, hovered, focusSet, activeKey],
  );

  const paintLink = useCallback(
    (link: CanvasLink, ctx: CanvasRenderingContext2D, scale: number) => {
      const from = endpointNode(link.source);
      const to = endpointNode(link.target);
      if (!from || !to) return;

      const sx = from.x ?? 0;
      const sy = from.y ?? 0;
      const tx = to.x ?? 0;
      const ty = to.y ?? 0;
      const touchesFocus =
        pointerFocus !== null &&
        (endpointId(link.source) === pointerFocus || endpointId(link.target) === pointerFocus);
      const dim = focusSet !== null && !touchesFocus;
      const isTag = link.kind === "tag";

      // A slight bow, so parallel links between two notes stay readable as synapses.
      const dx = tx - sx;
      const dy = ty - sy;
      const distance = Math.hypot(dx, dy) || 1;
      const bend = Math.min(36, distance * 0.18);
      const cx = (sx + tx) / 2 - (dy / distance) * bend;
      const cy = (sy + ty) / 2 + (dx / distance) * bend;

      ctx.globalAlpha = dim ? 0.05 : touchesFocus ? 0.7 : isTag ? 0.16 : 0.32;
      ctx.strokeStyle = isTag ? palette.tag : palette.edge;
      ctx.lineWidth = (touchesFocus ? 2 : 1) / scale;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cx, cy, tx, ty);
      ctx.stroke();

      if (touchesFocus) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = palette.edge;
        ctx.beginPath();
        ctx.arc(
          0.25 * sx + 0.5 * cx + 0.25 * tx,
          0.25 * sy + 0.5 * cy + 0.25 * ty,
          1.4 / scale,
          0,
          TAU,
        );
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    },
    [palette, pointerFocus, focusSet],
  );

  // The renderer reads these on every frame, so they are kept in a ref rather than
  // rebuilt into the instance: that way the painters always see this render's state.
  const paintersRef = useRef({ paintNode, paintLink, paintPointerArea });
  useEffect(() => {
    paintersRef.current = { paintNode, paintLink, paintPointerArea };
  });

  // One instance for the life of the view; the data and size arrive through effects below.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const graph = new ForceGraph<CanvasNode, CanvasLink>(host)
      .backgroundColor("transparent")
      .autoPauseRedraw(false)
      .minZoom(0.2)
      .maxZoom(9)
      .cooldownTicks(200)
      .warmupTicks(60)
      .nodeCanvasObjectMode(() => "replace")
      .nodeCanvasObject((node, ctx, scale) => paintersRef.current.paintNode(node, ctx, scale))
      .nodePointerAreaPaint((node, color, ctx) =>
        paintersRef.current.paintPointerArea(node, color, ctx),
      )
      .linkCanvasObjectMode(() => "replace")
      .linkCanvasObject((link, ctx, scale) => paintersRef.current.paintLink(link, ctx, scale))
      .onNodeClick((node) => setSelected(endpointId(node.id)))
      .onNodeHover((node) => setHovered(node ? endpointId(node.id) : null))
      .onBackgroundClick(() => setSelected(null));

    // Physics the way a force graph wants it: repulsion wide, links short.
    const charge = graph.d3Force("charge");
    const link = graph.d3Force("link");
    if (charge && typeof charge.strength === "function") charge.strength(-120);
    if (link && typeof link.distance === "function") link.distance(38);

    graphRef.current = graph;
    return () => {
      graphRef.current = null;
      graph._destructor();
    };
  }, []);

  useEffect(() => {
    graphRef.current?.width(size.width).height(size.height);
  }, [size.width, size.height]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.graphData(canvasData);
    graph.d3ReheatSimulation();
  }, [canvasData]);

  // Refit when the filters (or the vault itself) change the shape of the graph, not on every hover.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || canvasData.nodes.length === 0) return;
    const timer = window.setTimeout(() => graph.zoomToFit(500, 60), 250);
    return () => window.clearTimeout(timer);
  }, [canvasData]);

  const selectedNode = selected ? (data.nodes.find((n) => n.id === selected) ?? null) : null;
  const noteCount = visible.nodes.filter((node) => node.kind === "note").length;

  return (
    <section aria-label="Vault graph" className="relative flex-1 overflow-hidden bg-background">
      <div ref={hostRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/70 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showTags}
              onChange={(e) => setShowTags(e.currentTarget.checked)}
            />
            Tags
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showOrphans}
              onChange={(e) => setShowOrphans(e.currentTarget.checked)}
            />
            Unlinked
          </label>
          <label className="flex items-center gap-1.5">
            Depth
            <input
              type="range"
              min={0}
              max={DEPTH_MAX}
              value={depth}
              onChange={(e) => setDepth(Number(e.currentTarget.value))}
              className="w-20"
            />
            <span className="w-16 tabular-nums">
              {depth === 0 ? "whole vault" : `${depth} hop${depth === 1 ? "" : "s"}`}
            </span>
          </label>
          <button
            type="button"
            onClick={() => graphRef.current?.zoomToFit(500, 60)}
            className="rounded-md border border-border px-2 py-0.5 hover:bg-accent hover:text-foreground"
          >
            Fit
          </button>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-1 rounded-lg border border-border bg-card/70 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur">
          <span className="tabular-nums">
            {noteCount} {noteCount === 1 ? "note" : "notes"} · {visible.edges.length} links ·{" "}
            {data.unresolved.length} unresolved
          </span>
          <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
            {FOLDERS.map((folder, index) => (
              <span key={folder} className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: palette.folders[index] ?? palette.tag }}
                />
                {folder}
              </span>
            ))}
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-3">
        <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-border bg-card/70 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur">
          {selectedNode ? (
            <>
              <span className="max-w-72 truncate text-foreground">{selectedNode.label}</span>
              {selectedNode.kind === "note" ? (
                <span className="tabular-nums">
                  {selectedNode.inDegree} in · {selectedNode.outDegree} out
                </span>
              ) : (
                <span>tag</span>
              )}
              {selectedNode.kind === "note" ? (
                <button
                  type="button"
                  onClick={() => onOpen(selectedNode.id)}
                  className="rounded-md border border-border px-2 py-0.5 hover:bg-accent hover:text-foreground"
                >
                  Open note
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onFilterTag(selectedNode.label)}
                  className="rounded-md border border-border px-2 py-0.5 hover:bg-accent hover:text-foreground"
                >
                  Show notes
                </button>
              )}
            </>
          ) : (
            <span>
              Hover a node to pull its links forward, click to select it, scroll to zoom. A depth of
              1 or more centres on your open note until you pick a node.
            </span>
          )}
        </div>
        <div className="pointer-events-auto rounded-lg border border-border bg-card/70 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur">
          {source === "live"
            ? "Live vault"
            : connection === "connecting"
              ? "Connecting to daemon…"
              : "Offline — demo vault"}
        </div>
      </div>

      {loading ? (
        <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          Loading the vault…
        </p>
      ) : visible.nodes.length === 0 ? (
        <p className="absolute inset-0 flex items-center justify-center p-10 text-center text-sm text-muted-foreground">
          Nothing to graph yet. Notes become nodes, and a line appears between two of them as soon
          as one links to the other with [[a title]].
        </p>
      ) : null}
    </section>
  );
}
