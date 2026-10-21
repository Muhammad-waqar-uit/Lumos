# Desktop

The desktop app is the viewing half of Lumos: a Tauri desktop shell around a React UI that browses
the Markdown vault. It lives in [`apps/desktop`](../apps/desktop).

## Status

The dark shell is built. The app renders a three-pane layout and loads the vault from the running
daemon (falling back to demo data when the daemon is offline):

- `src/App.tsx` - state, vault loading, folder + search filtering, selection
- `src/components/Sidebar.tsx` - folders with note counts
- `src/components/NoteList.tsx` - searchable note list (title, date, preview, tags)
- `src/components/NoteViewer.tsx` - note header (folder, date, source, url) + backlinks + link pane + Markdown body
- `src/components/LinkPane.tsx` - the note's link: video player, image, or scraped reader card
- `src/components/GraphView.tsx` - canvas link graph (routes, controls, click-to-open)
- `src/components/PaneBoundary.tsx` - error boundary around the lazily loaded graph pane
- `src/components/SearchModal.tsx` - the `Cmd/Ctrl+K` palette: ranked matches, keyboard selection, body matches from the daemon
- `src/components/StatusBar.tsx` - connection state, the search shortcut and the note count
- `src/lib/api.ts` - daemon client (`/notes`, `/notes/search`, `/folders`, `/note`, `/graph`, `/link`)
- `src/lib/graph-palette.ts` - reads the `--color-graph-*` tokens and maps a folder to its hue, with a fallback token per lookup
- `src/lib/demo.ts` - demo data used when the daemon is not running
- `src/lib/search.ts` - fuse.js index over the loaded notes, plus the merge of local and body matches
- `src/index.css` - Tailwind v4 import + dark design tokens + `.markdown` typography for notes

### Markdown rendering

Note bodies render with `react-markdown` + `remark-gfm`, so headings, nested and ordered lists,
tables, task lists, blockquotes, fenced code and links all render instead of showing raw syntax.
Links are overridden to open with `target="_blank"` and `rel="noreferrer"` so a click cannot
navigate the app window away from the vault.

Styling lives in the `.markdown` rules in `src/index.css` and uses the existing theme tokens, so no
colour is hardcoded in a component.

Fenced code is highlighted by `rehype-highlight` (highlight.js through lowlight). Only a fence that
names a language is highlighted: `detect` is off, because guessing colours prose as `json` and an
unlabelled block as something it is not. A fence in a language the plugin does not register (it ships
the 37 common ones) is left as plain text and reported on the file instead of throwing, so an
unknown ` ```zig ` block cannot break a note. The colours are `--color-code-*` tokens defined beside
the graph hues in `src/index.css`; no highlight theme stylesheet is imported, so the code blocks use
the app's own near-black palette.

The three cases - a registered language, an unregistered one, and an untagged fence - are rendered
to a string in Node and asserted in `src/components/NoteViewer.test.tsx`, so the wiring has a test
without a jsdom setup.

Still to come: resizable panes, routing, and a note editor (see [`TODO.md`](TODO.md) Phases 4-7).

### Link pane

A note that carries a link — `/read <link>` from WhatsApp puts it in the frontmatter and the body —
shows that link in the viewer instead of only linking out.

- A **YouTube or Vimeo** link becomes a player in a 16:9 frame, on the no-cookie embed host, with an
  “Open on …” link beside it. The embed URL comes from the URL alone, so a video plays with the
  daemon stopped. Verified end to end: the frame loads the embed document and, once clicked, plays.
- An **Instagram** permalink (`/p/`, `/reel/`, `/tv/`, including one written under the account name)
  becomes the captioned embed in a portrait frame; a **Facebook** video, reel or `watch` link becomes
  the plugin video player, and a Facebook post or photo the taller post card, which keeps the caption
  and the reaction counts. The frame is chosen by `LinkMedia.frame` — `portrait` or `tall`, else 16:9 —
  rather than guessed from the URL in the component.
- Those four embed kinds are also fetched, for their metadata: the card under the frame carries the
  caption or post text, the site and the lead image. The frame itself never waits on that fetch, so
  with the daemon stopped a reel still plays; only the card is missing, and the pane says so instead
  of leaving a gap.
- An **image** link renders the image itself, capped in height, with its filename as the alt text.
- Any other **page** is scraped by the daemon and shown as a card: title, site, description and lead
  image, with the page's readable text underneath. The text is rendered as text, never as HTML. If it
  was cut at the 6,000-character cap the pane says so and offers the real page.
- States: a loading line while the page is read, the daemon's own refusal message with a **Retry**
  beside it (a private host, a non-page content type, a timeout), and — with the daemon down — a line
  saying the page cannot be read while the link itself stays clickable.

A page is read once per session. `src/lib/link-cache.ts` keeps the card by URL at module scope,
because the pane unmounts whenever the note or the tab changes, and it hands a second caller the
request already in flight - which is also why StrictMode's double mount costs one request instead of
two. The pane reads the cache at render, so a page it already holds never flashes “Reading the page…”
on the way back. A refusal or a failure is not cached, so **Retry** really retries; a reload starts
empty, and there is no per-page refresh beyond that.

The classification is `parseLinkMedia()` and the text extraction is `extractPreview()`, both in
`@lumos/vault-utils/link`: pure, browser-safe, so the desktop classifies with the same code the
daemon scrapes with. `firstExternalLink()` finds the link in a note body when the frontmatter has
none, ignoring code fences the way the graph does.

The reader is text only - no layout, no in-body images, no code formatting, and JavaScript-rendered
pages come back nearly empty. An Instagram or Facebook permalink is the extreme case of that: its
readable text is empty (0 characters for a public reel), which is why those hosts get the embed and
its metadata card instead of a reader. [LIMITATIONS.md](LIMITATIONS.md) is the list, with what each
limit gives up.

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
- The layout survives a tab switch. Switching tabs unmounts the canvas, and `force-graph` lays a new
  graph out on construction, so the coordinates are kept outside the component in
  `src/lib/graph-layout.ts` and seeded back into the nodes on mount. A view the user panned or zoomed
  is restored as well (zoom plus the graph-space centre); a view the app fitted itself is fitted
  again. Coordinates for notes the vault no longer has are pruned, so a deleted note cannot hand its
  place to a new one with the same id.
- The first fit waits for the simulation to stop rather than a timer: a fit taken mid-layout framed
  the nodes where they were heading, which left the outer ones against the border. A remembered
  layout is not relaxed at all - the warm-up ticks are skipped and the engine stopped, since
  `graphData()` would otherwise re-solve a layout that was already correct.
- A resized pane refits when the view was the app's own fit. A view the user placed is left alone -
  an explicit pan outlasts an automatic one - and *Fit*, a filter change or a depth change takes it
  back. Gestures are the signal: a wheel event or a pointer drag counts as taking over, while the
  app's own zooms fire nothing. Those listeners are on the host in the *capture* phase, because the
  renderer's zoom handler stops wheel and drag events from propagating.

The renderer is `force-graph` (canvas), driven through its **vanilla instance API** rather than its
React wrapper: in `force-graph` 1.52 those props are linked to the internal canvas graph and the
wrapper's prop forwarding drops them silently, so the canvas-object props and `autoPauseRedraw`
never reached the renderer. The pane is `React.lazy`-loaded, because the renderer is the heaviest
dependency in the app, and wrapped in `PaneBoundary` so a failed chunk shows an error with a retry
instead of a blank screen.

The `--color-graph-*` tokens are declared as plain custom properties in `:root` rather than Tailwind
theme entries: Tailwind prunes theme values it cannot see used in a class name, so palette steps
referenced only from TypeScript would never reach the stylesheet.

The pure parts are tested: the layout memory (`src/lib/graph-layout.test.ts`, 12 cases) and the
neighbourhood and backlink rules in `@lumos/vault-utils`. The canvas itself has no component test -
that needs jsdom + Testing Library, tracked in [`TODO.md`](TODO.md) Phase 0.1 - so a tab switch is
checked by hand.

### Tag filtering

- The note list offers the tags present in the current folder and query as chips, most used first,
  each with how many of the listed notes carry it.
- Clicking a chip narrows the list to that tag and clicking it again clears it. A note's own tag in
  its card is the same control, so a tag is a filter wherever it appears.
- Folder and query decide which tags are on offer; the tag then narrows that same set, which is why a
  count is always a count of what is listed. An active tag stays in the row even when nothing matches,
  so it can be switched off.
- A selected tag survives a folder change, and the empty state names it (`No notes tagged #travel.`)
  rather than looking like an empty vault.
- Selecting a tag node in the graph offers **Show notes**, which returns to the notes view with that
  tag filtered - the same handler the chips use.
- The filtering is pure logic in `src/lib/filter.ts`, covered by `src/lib/filter.test.ts`. The desktop
  workspace has its own `test` script, so `pnpm --filter desktop test` checks it.
- The offline demo notes carry the same tags their bodies declare (`src/lib/demo.ts`), so the chips
  and the filter work with the daemon stopped; `demo.test.ts` keeps the listing and the bodies in
  step.

## Planned structure

- **Shell**: Tauri 2.x (Rust backend) hosting a Vite + React frontend.
- **UI**: Tailwind CSS + shadcn/ui, dark minimal theme (see [`design.md`](design.md)).
- **Routing**: TanStack Router.
- **State**: zustand stores for the vault index, current folder, current note, and filters.
- **Rendering**: `react-markdown` + `remark-gfm` for notes, `force-graph` for the link graph and
  `fuse.js` for search (all in use); `lucide-react` for icons (planned).

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

### Backlinks

Under the header, a note lists the notes that link to it ("Linked from 2"), each a button that opens
that note. The list is computed by `backlinks()` in `@lumos/vault-utils/graph` from the graph the app
already holds, so it costs no request and works offline against the demo graph. Only note links count:
a note that merely shares a tag is a neighbour in the graph view, not a backlink, because "linked
from" would otherwise mean every note carrying the same hashtag.

## Search palette

`Cmd/Ctrl+K`, or the **Search** button in the status bar, opens a palette over the whole vault rather
than the filtered list. It narrows in two stages and says which one answered:

- Titles, tags and previews are matched locally by `fuse.js` (weighted, typo-tolerant, ranked). This
  needs no daemon, so it works against the demo vault too.
- With the daemon running, the same query is sent to `GET /notes/search`, which reads whole files, so
  a word that only appears deep in a body still finds the note. Those rows carry an **in the body**
  marker. The request is debounced and stamped with the query it answered, so a slow reply cannot
  appear under newer text; a failure is named in the footer instead of being hidden.
- `↑`/`↓` move, `Enter` opens the note in the Notes view, `Esc` closes. Focus returns to the control
  that had it before the palette opened.
- With nothing typed, the palette lists the notes opened this session, newest first (up to five).
  The history is kept in `App` as note keys, so every route into a note counts - the list, a graph
  node, a backlink or the palette itself - and the rows are the same result shape, which is why the
  arrow keys work there without a second code path. `recentEntries()` resolves the keys against the
  loaded listing, so a note that left the vault is skipped instead of leaving a dead row. A reload
  starts empty: the history is session memory, not storage.

## Keyboard

Wired today:

- `Cmd/Ctrl+K` - open or close the search palette.
- `Esc` - close the palette.
- `↑` `↓` `Enter` - move through the palette and open the selection.

Still to come: `j`/`k`-style movement through the note list (tracked in [`TODO.md`](TODO.md)).

## Planned capabilities

- Resizable panes, TanStack Router and zustand - the shell is plain React state in one component.
- Every entry in the Keyboard section above.
- Recent notes in the palette, so an untyped palette is useful rather than empty.
- Markdown editor with live preview and save-to-disk.
