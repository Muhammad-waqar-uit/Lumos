// @vitest-environment jsdom
//
// The canvas itself is the one thing jsdom cannot exercise: force-graph draws pixels, and no
// assertion here watches a single one. What is tested is the React half the docs used to call
// untested - which nodes are handed to the renderer after each control, what selecting a node
// offers, and the wording of the states around the canvas.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphData } from "@lumos/shared";
import { GraphView } from "./GraphView";

/** One payload the component handed the renderer, as the renderer would see it. */
interface Payload {
  nodes: { id: string }[];
  links: unknown[];
}

type Handler = (...args: unknown[]) => void;

/** The renderer API GraphView drives, recorded instead of drawing. The class lives in `vi.hoisted`
 * because `vi.mock` is hoisted above every module-level declaration. */
const { MockForceGraph } = vi.hoisted(() => {
  class MockForceGraph {
    static last: MockForceGraph | null = null;
    readonly handlers = new Map<string, Handler>();
    readonly payloads: Payload[] = [];
    fitCalls = 0;
    private cooldown = 200;
    private warmup = 60;

    constructor(_host: Element) {
      MockForceGraph.last = this;
    }
    backgroundColor(): this {
      return this;
    }
    autoPauseRedraw(): this {
      return this;
    }
    minZoom(): this {
      return this;
    }
    maxZoom(): this {
      return this;
    }
    cooldownTicks(value?: number): number | this {
      if (value === undefined) return this.cooldown;
      this.cooldown = value;
      return this;
    }
    warmupTicks(value?: number): number | this {
      if (value === undefined) return this.warmup;
      this.warmup = value;
      return this;
    }
    nodeCanvasObjectMode(): this {
      return this;
    }
    nodeCanvasObject(): this {
      return this;
    }
    nodePointerAreaPaint(): this {
      return this;
    }
    linkCanvasObjectMode(): this {
      return this;
    }
    linkCanvasObject(): this {
      return this;
    }
    onNodeClick(handler: Handler): this {
      this.handlers.set("nodeClick", handler);
      return this;
    }
    onNodeHover(handler: Handler): this {
      this.handlers.set("nodeHover", handler);
      return this;
    }
    onBackgroundClick(handler: Handler): this {
      this.handlers.set("backgroundClick", handler);
      return this;
    }
    onEngineStop(handler: Handler): this {
      this.handlers.set("engineStop", handler);
      return this;
    }
    d3Force(): { strength: () => void; distance: () => void } {
      return { strength: () => undefined, distance: () => undefined };
    }
    d3ReheatSimulation(): this {
      return this;
    }
    width(): this {
      return this;
    }
    height(): this {
      return this;
    }
    graphData(payload?: Payload): Payload | this {
      if (payload === undefined)
        return this.payloads[this.payloads.length - 1] ?? { nodes: [], links: [] };
      this.payloads.push(payload);
      return this;
    }
    zoomToFit(): this {
      this.fitCalls += 1;
      return this;
    }
    zoom(): number {
      return 1;
    }
    centerAt(): { x: number; y: number } {
      return { x: 0, y: 0 };
    }
    _destructor(): void {
      MockForceGraph.last = null;
    }
  }
  return { MockForceGraph };
});

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);
vi.mock("force-graph", () => ({ default: MockForceGraph }));

const graph: GraphData = {
  nodes: [
    {
      id: "Inbox/Alpha.md",
      label: "Alpha",
      kind: "note",
      folder: "Inbox",
      tags: [],
      inDegree: 1,
      outDegree: 2,
      orphan: false,
    },
    {
      id: "Inbox/Solo.md",
      label: "Solo",
      kind: "note",
      folder: "Inbox",
      tags: [],
      inDegree: 0,
      outDegree: 0,
      orphan: true,
    },
    {
      id: "Ideas/Beta.md",
      label: "Beta",
      kind: "note",
      folder: "Ideas",
      tags: ["project"],
      inDegree: 1,
      outDegree: 1,
      orphan: false,
    },
    {
      id: "#project",
      label: "#project",
      kind: "tag",
      tags: [],
      inDegree: 1,
      outDegree: 0,
      orphan: false,
    },
  ],
  edges: [
    { source: "Inbox/Alpha.md", target: "Ideas/Beta.md", kind: "link" },
    { source: "Ideas/Beta.md", target: "#project", kind: "tag" },
  ],
  unresolved: [{ source: "Inbox/Alpha.md", target: "Missing Note" }],
};

const empty: GraphData = { nodes: [], edges: [], unresolved: [] };

function renderGraph(overrides: Partial<Parameters<typeof GraphView>[0]> = {}) {
  const onOpen = vi.fn();
  const onFilterTag = vi.fn();
  render(
    <GraphView
      data={graph}
      source="live"
      connection="daemon"
      loading={false}
      activeKey={null}
      onOpen={onOpen}
      onFilterTag={onFilterTag}
      folders={["Inbox", "Ideas"]}
      {...overrides}
    />,
  );
  const instance = MockForceGraph.last;
  if (!instance) throw new Error("the component never built a renderer");
  return { onOpen, onFilterTag, instance };
}

/** The ids of the nodes the renderer was last handed. */
function lastNodeIds(instance: InstanceType<typeof MockForceGraph>): string[] {
  const payload = instance.payloads[instance.payloads.length - 1];
  if (!payload) throw new Error("no data reached the renderer");
  return payload.nodes.map((node) => node.id);
}

beforeEach(() => {
  MockForceGraph.last = null;
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GraphView", () => {
  it("hands the whole vault to the renderer, and counts what it shows", () => {
    const { instance } = renderGraph();

    expect(lastNodeIds(instance).sort()).toEqual(
      ["#project", "Inbox/Alpha.md", "Inbox/Solo.md", "Ideas/Beta.md"].sort(),
    );
    expect(screen.getByText("3 notes · 2 links · 1 unresolved")).toBeDefined();
  });

  it("drops the tag nodes, and their edges, when Tags is off", () => {
    const { instance } = renderGraph();

    fireEvent.click(screen.getByLabelText("Tags"));

    const ids = lastNodeIds(instance);
    expect(ids).not.toContain("#project");
    expect(screen.getByText("3 notes · 1 link · 1 unresolved")).toBeDefined();
  });

  it("drops the unlinked notes when Unlinked is off", () => {
    const { instance } = renderGraph();

    fireEvent.click(screen.getByLabelText("Unlinked"));

    const ids = lastNodeIds(instance);
    expect(ids).not.toContain("Inbox/Solo.md");
    expect(ids).toContain("Inbox/Alpha.md");
    expect(screen.getByText("2 notes · 2 links · 1 unresolved")).toBeDefined();
  });

  it("centres a depth on the open note, and says how many hops it is showing", () => {
    const { instance } = renderGraph({ activeKey: "Ideas/Beta.md" });

    fireEvent.change(screen.getByRole("slider", { name: /Depth/ }), { target: { value: "1" } });

    // One hop from Beta: the note it links to and the tag it carries - not the whole vault.
    expect(lastNodeIds(instance).sort()).toEqual(
      ["#project", "Inbox/Alpha.md", "Ideas/Beta.md"].sort(),
    );
    expect(screen.getByText("1 hop")).toBeDefined();

    fireEvent.change(screen.getByRole("slider", { name: /Depth/ }), { target: { value: "0" } });
    expect(lastNodeIds(instance)).toHaveLength(4);
    expect(screen.getByText("whole vault")).toBeDefined();
  });

  it("selects a note from the canvas and opens it, and a background click lets go", () => {
    const { onOpen, instance } = renderGraph();

    act(() => instance.handlers.get("nodeClick")?.({ id: "Inbox/Alpha.md" }));
    expect(screen.getByText("Alpha")).toBeDefined();
    expect(screen.getByText("1 in · 2 out")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Open note" }));
    expect(onOpen).toHaveBeenCalledWith("Inbox/Alpha.md");

    act(() => instance.handlers.get("backgroundClick")?.());
    expect(screen.queryByRole("button", { name: "Open note" })).toBeNull();
  });

  it("offers Show notes on a tag node, passing the tag as the filter", () => {
    const { onFilterTag, instance } = renderGraph();

    act(() => instance.handlers.get("nodeClick")?.({ id: "#project" }));

    expect(screen.getByText("tag")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Show notes" }));
    expect(onFilterTag).toHaveBeenCalledWith("#project");
  });

  it("says where the graph came from", () => {
    renderGraph({ source: "demo", connection: "connecting" });
    expect(screen.getByText("Connecting to daemon…")).toBeDefined();
    cleanup();

    renderGraph({ source: "demo", connection: "demo" });
    expect(screen.getByText("Offline — demo vault")).toBeDefined();
    cleanup();

    renderGraph({ source: "live" });
    expect(screen.getByText("Live vault")).toBeDefined();
  });

  it("shows the loading and empty states over the canvas", () => {
    renderGraph({ loading: true });
    expect(screen.getByText("Loading the vault…")).toBeDefined();
    cleanup();

    renderGraph({ data: empty });
    expect(screen.getByText(/Nothing to graph yet/)).toBeDefined();
    expect(screen.getByText("0 notes · 0 links · 0 unresolved")).toBeDefined();
  });

  it("fits the view on the button, without touching the notes view", () => {
    const { onOpen, instance } = renderGraph();

    fireEvent.click(screen.getByRole("button", { name: "Fit" }));

    expect(instance.fitCalls).toBeGreaterThan(0);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
