# Explainers — planned, not built

Nothing in this file is implemented. It is the shape of an idea worth keeping: animated, steppable
explanations of how a thing in Lumos works, drawn from the same source that writes them down for an
agent.

Status: **planned**, Phase 10 / M9. The decision and its cost are in
[PLAN.md](PLAN.md#decisions-log); the work is under Phase 10 in [TODO.md](TODO.md).

## Why it is worth a phase

Lumos has two audiences and, until now, two separate explanations of itself: prose and screenshots
for a person, and tool descriptions for an agent. A steppable scene produces **both from one
source** — SVG frames as it plays, and a text form plus a state trace at every step. That is the
whole reason [lantern](https://github.com/ivarvong/lantern) is on this page: its author built it for
explaining code, and the same model fits "how a message becomes a note".

## What lantern actually is

Facts that decide the cost, read from the repository rather than assumed:

- A zero-dependency TypeScript port of manim's core model: a scene is a class, a step is a marker,
  text is glyph outlines from embedded fonts, animation is a pure function of alpha. Zero runtime
  dependencies — only dev dependencies for its own tools.
- **MIT licensed** (Ivar Vong), so vendoring is allowed with the notice kept.
- **Not on npm.** Its `package.json` names it `manim-js` at `0.1.0` and the README says it is not
  published, so the realistic integration is a pinned git dependency or a vendored copy compiled
  with its own `tsc -p tsconfig.lib.json`. Node `>= 20`, which this repository already exceeds.
- Four outputs, and the second and third are the interesting ones here:
  - a DOM player with `?scene=&step=` deep links,
  - **one frame as SVG** (`renderAt(scene, t, new SnapshotSink())`), which a build step can commit,
  - **one frame as text** (`renderText(scene)`) and a per-step trace (`traceScene`),
  - every frame (`tools/render.ts`).
- Deterministic on purpose: seeking re-runs the scene with frames skipped and produces byte-identical
  output, and its tests hold golden traces. That matters for us — committed SVG frames can be diffed
  like the screenshots in `docs/images/`, and a regenerate either matches or says what changed.

## Where it would earn its place

### 1. Explainers in the docs — the recommended first slice

A scene per explanation, **rendered at build time into SVG frames**, committed, and embedded in the
page where the prose is. Two are worth writing before anything else:

- **A message becomes a note** — the message arrives, the sender is checked, the text is parsed, the
  folder is chosen, the file is written, the reply goes back. One step each, which is exactly the
  order in [ARCHITECTURE.md](ARCHITECTURE.md) and exactly the order a newcomer gets wrong.
- **What an MCP tool call touches** — the client, the server, `@lumos/vault-utils`, and the file,
  including the path where a bad key is refused and no file is opened. This one is new enough that
  nobody has internalised it yet, and it explains [mcp.md](mcp.md)'s safety claim in one picture.

Cost: **nothing enters an app bundle.** The engine runs in a render script, the output is assets, so
the size of the library is paid once at build time rather than on every launch. This is the cheapest
honest way to find out whether the model fits at all.

### 2. An "Explain" panel in the app — the product idea

A note, or a cluster in the graph, walked through one step at a time: this note, then the notes it
links to, then the tags they share, then what it is not connected to. The graph already draws the
shape and lets you move it; the explainer would tell the **story**, which is what a person asking
"why are these notes connected" is actually asking.

The same scene could be answered as text over MCP, so an agent gets the narration without the
drawing — one source, two readings.

Cost, and the reason this is gated: the engine would be in the desktop bundle, with a player
component over its DOM sink themed with our tokens, **beside** the canvas force graph. Two rendering
models for the same data is a real duplication — one draws for interaction, the other for narration —
so the second user of it has to justify the first's weight.

### 3. Teaching the vault format — small and cheap

`2026-10-26-plan-the-week.md` taken apart: the date prefix, the slug, the extension, then the
frontmatter fields lighting up one by one, then the same file opened in another editor to show the
bytes are the same. It is the thing people get wrong (renaming by hand, hand-written frontmatter) at
the point they get it wrong. Rendered into the docs like slice 1, not shipped to the app.

### Not a fit: code-change explainers

Lantern's own reason for existing — before and after of a code change, with the diff as the subject.
Lumos stores notes, not history: there is no diff to explain, and no plan for a note-level version
history. Written down so the idea is not re-opened from the library's title alone.

## The spike (one afternoon, one TODO item)

The point is to replace the guesses below with numbers:

1. Vendor lantern at a pinned commit (`vendor/lantern/`, MIT notice kept) or pin it as a git
   dependency, then compile it with its own library build.
2. Render the capture-pipeline scene to SVG in Node 24 and **measure**: compiled `dist/` size, one
   frame's size, how long a render takes, and how many frames a five-step scene produces.
3. Drop the frames into a doc page and read it at phone width and at desktop width.
4. Decide: docs only (keep slice 1), in-app (start slice 2), or drop it.

The measured numbers belong in this file; the decision belongs in the PLAN decisions log.

## What would make us drop it

- A frame is not legible at the size a document shows it, so the picture needs prose anyway.
- The compiled engine is large relative to the problem — measured in the spike, not estimated here.
- The scenes restate paragraphs that already work. An explainer that says the same thing worse than
  the sentence it replaces is a loss, and the docs are currently the part of this project that costs
  the least to trust.
