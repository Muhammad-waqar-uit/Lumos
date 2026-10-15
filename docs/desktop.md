# Desktop

The desktop app is the viewing half of Lumos: a Tauri desktop shell around a React UI that browses
the Markdown vault. It lives in [`apps/desktop`](../apps/desktop).

## Status

The dark shell is built. The app renders a three-pane layout and loads the vault from the running
daemon (falling back to demo data when the daemon is offline):

- `src/App.tsx` - state, vault loading, folder + search filtering, selection
- `src/components/Sidebar.tsx` - folders with note counts
- `src/components/NoteList.tsx` - searchable note list (title, date, preview, tags)
- `src/components/NoteViewer.tsx` - note header (folder, date, source, url) + link pane + Markdown body
- `src/components/LinkPane.tsx` - the note's link: video player, image, or scraped reader card
- `src/components/GraphView.tsx` - canvas link graph (routes, controls, click-to-open)
- `src/components/PaneBoundary.tsx` - error boundary around the lazily loaded graph pane
- `src/components/StatusBar.tsx` - connection state + note count
- `src/lib/api.ts` - daemon client (`/notes`, `/notes/search`, `/folders`, `/note`, `/graph`, `/link`)
- `src/lib/graph-palette.ts` - pure helpers mapping a node to its colour index and radius
- `src/lib/demo.ts` - demo data used when the daemon is not running
- `src/index.css` - Tailwind v4 import + dark design tokens + `.markdown` typography for notes

### Markdown rendering

Note bodies render with `react-markdown` + `remark-gfm`, so headings, nested and ordered lists,
tables, task lists, blockquotes, fenced code and links all render instead of showing raw syntax.
Links are overridden to open with `target="_blank"` and `rel="noreferrer"` so a click cannot
navigate the app window away from the vault.

Styling lives in the `.markdown` rules in `src/index.css` and uses the existing theme tokens, so no
colour is hardcoded in a component. Fenced code blocks are styled but not yet syntax-highlighted.

Still to come: tag filtering, code syntax highlighting, resizable panes, routing, and a note editor
(see [`TODO.md`](TODO.md) Phases 4-7).

### Link pane

A note that carries a link — `/read <link>` from WhatsApp puts it in the frontmatter and the body —
shows that link in the viewer instead of only linking out.

- A **YouTube or Vimeo** link becomes a player in a 16:9 frame, on the no-cookie embed host, with an
  “Open on …” link beside it. The embed URL comes from the URL alone, so a video plays with the
  daemon stopped. Verified end to end: the frame loads the embed document and, once clicked, plays.
- An **image** link renders the image itself, capped in height, with its filename as the alt text.
- Any other **page** is scraped by the daemon and shown as a card: title, site, description and lead
  image, with the page's readable text underneath. The text is rendered as text, never as HTML. If it
  was cut at the 6,000-character cap the pane says so and offers the real page.
- States: a loading line while the page is read, the daemon's own refusal message with a **Retry**
  beside it (a private host, a non-page content type, a timeout), and — with the daemon down — a line
  saying the page cannot be read while the link itself stays clickable.

The classification is `parseLinkMedia()` and the text extraction is `extractPreview()`, both in
`@lumos/vault-utils/link`: pure, browser-safe, so the desktop classifies with the same code the
daemon scrapes with. `firstExternalLink()` finds the link in a note body when the frontmatter has
none, ignoring code fences the way the graph does.

The reader is text only - no layout, no in-body images, no code formatting, and JavaScript-rendered
pages come back nearly empty. [LIMITATIONS.md](LIMITATIONS.md) is the list, with what each limit
gives up.

### Graph view

The header switches between **Notes** and **Graph**. Both read the same vault: the graph pane draws
`getGraph()` from the daemon, or `DEMO_GRAPH` when the daemon is down.

- Nodes are notes and tags; edges are `[[wikilinks]]` / relative `.md` links plus tag references.
  Radius grows with a note's `inDegree`, so linked-to notes read as hubs.
- One hue per folder, taken from the `--color-graph-folder-*` tokens in `src/index.css`; tags use
  `--color-graph-tag`. Nothing is hardcoded in the component.
- Controls: tag and unlinked note filters, and a depth step that shrinks the graph to the notes
  within *n* hops of the selected note. Depth filtering is local, using `neighborhood()` on data
  already in memory - changing it does not refetch.
- Clicking a node selects it: the panel shows its in/out degree and an **Open note** button that opens
  it in the Notes view. Background clicks clear the selection.

The renderer is `force-graph` (canvas), driven through its **vanilla instance API** rather than its
React wrapper: in `force-graph` 1.52 those props are linked to the internal canvas graph and the
wrapper's prop forwarding drops them silently, so the canvas-object props and `autoPauseRedraw`
never reached the renderer. The pane is `React.lazy`-loaded, because the renderer is the heaviest
dependency in the app, and wrapped in `PaneBoundary` so a failed chunk shows an error with a retry
instead of a blank screen.

The `--color-graph-*` tokens are declared as plain custom properties in `:root` rather than Tailwind
theme entries: Tailwind prunes theme values it cannot see used in a class name, so palette steps
referenced only from TypeScript would never reach the stylesheet.

There is no desktop test coverage yet: the vitest suites cover `@lumos/vault-utils` and the daemon.
Component tests need jsdom + Testing Library and are tracked in [`TODO.md`](TODO.md) Phase 0.1.

## Planned structure

- **Shell**: Tauri 2.x (Rust backend) hosting a Vite + React frontend.
- **UI**: Tailwind CSS + shadcn/ui, dark minimal theme (see [`design.md`](design.md)).
- **Routing**: TanStack Router.
- **State**: zustand stores for the vault index, current folder, current note, and filters.
- **Rendering**: `react-markdown` + `remark-gfm` for notes and `force-graph` for the link graph (both
  in use); `fuse.js` for search and `lucide-react` for icons (planned).

## Layout

A resizable three-pane shell:

```
┌───────────┬────────────────────┬────────────────────────────┐
│ Sidebar   │ Notes list         │ Note viewer                │
│ (folders) │ (sorted by date)   │ (Markdown rendered)        │
└───────────┴────────────────────┴────────────────────────────┘

On the **Graph** tab the list and viewer are replaced by the link graph, with its controls in a
header bar above the canvas. The sidebar stays visible in both views.
```

## Access to the vault

The desktop currently reads the vault through the **daemon HTTP API** (which uses
`@lumos/vault-utils`, so parsing stays in one place). Set `VITE_DAEMON_URL` to point elsewhere;
it defaults to `http://127.0.0.1:3001`.

A future path is **Tauri filesystem/Rust commands** to read and parse Markdown directly, so the
app works without the daemon running. Both are kept possible by keeping logic in `packages/`
(see [`ARCHITECTURE.md`](ARCHITECTURE.md)).

## Keyboard

- `Cmd/Ctrl+K` - open the search modal.
- Arrow keys / `j` `k` - move through the note list.
- `Esc` - close overlays.

## Planned capabilities

- Folder sidebar with note counts.
- Note list with date, tags, and a text preview.
- Note viewer with frontmatter metadata (done) and syntax-highlighted code (planned).
- Full-text search across titles, content, and tags.
- Markdown editor with live preview and save-to-disk.
