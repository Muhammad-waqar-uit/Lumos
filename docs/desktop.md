# Desktop

The desktop app is the viewing half of Lumos: a Tauri desktop shell around a React UI that browses
the Markdown vault. It lives in [`apps/desktop`](../apps/desktop).

## Status

The dark shell is built. The app renders a three-pane layout and loads the vault from the running
daemon (falling back to demo data when the daemon is offline):

- `src/App.tsx` - the shell: wires the store, the router and the components together; *where you are* (the pane and the open note) comes from the address, not from local state
- `src/router.tsx` - the TanStack Router factory: one route at `/` whose typed search parameters carry `view` and `note`, validated so a hand-edited address cannot smuggle a pane in
- `src/lib/store.ts` - the vault store (zustand): the daemon read with its demo fallback, the re-read after every change, and the list's filters
- `src/components/Sidebar.tsx` - the brand row (mark + wordmark), the Notes/Graph/Trash view switch, and folders with note counts
- `src/components/LumosMark.tsx` - the mark itself, drawn inline in `currentColor` so it takes `--color-brand` from the theme
- `src/components/NoteList.tsx` - searchable note list (title, date, preview, tags) and the **New** button that opens the composer
- `src/components/NoteComposer.tsx` - a new note: a folder picker, a textarea, Create, Cancel, and a failure that keeps the draft
- `src/components/NoteViewer.tsx` - note header (folder, date, source, url) + backlinks + link pane + Markdown body, the Edit button that turns the body into the editor, and the **...** button that opens the file operations
- `src/components/NoteEditor.tsx` - the body as a textarea with a live preview of the draft beside it: Save, Cancel, the preview toggle, the unsaved marker and a failure that keeps the draft
- `src/components/NoteMeta.tsx` - the strip under the note header: tag chips with a remove button, a field that adds one, and a status picker; a failure stays on screen and keeps the draft
- `src/components/Markdown.tsx` - the one Markdown renderer, used by the reader and by the editor's preview
- `src/components/NoteActions.tsx` - rename, move and delete for the open note: a menu, a rename field, a folder picker, a delete that asks first, and a failure that keeps the panel open
- `src/components/TrashPanel.tsx` - what a delete kept: every trashed note with its folder and when, a Restore per entry, and an Empty that asks first
- `src/components/LinkPane.tsx` - the note's link: video player, image, or scraped reader card
- `src/components/GraphView.tsx` - canvas link graph (routes, controls, click-to-open)
- `src/components/PaneBoundary.tsx` - error boundary around the lazily loaded graph pane
- `src/components/SearchModal.tsx` - the `Cmd/Ctrl+K` palette: ranked matches, keyboard selection, body matches from the daemon
- `src/components/StatusBar.tsx` - connection state, the search shortcut, the note count, and a notice the app needs to say (a save whose refresh failed), plus the one action that answers it (**Undo** for a delete)
- `src/lib/list-nav.ts` - the arithmetic behind `j`/`k` in the note list, plus the rule for when a key belongs to a field
- `src/lib/api.ts` - daemon client (`/notes`, `/notes/search`, `/folders`, `/note` for reading, saving, renaming and deleting, `/note/move`, `/trash` for listing, emptying and restoring, `/graph`, `/link`)
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

Still to come: routing (see the **Plan** section of [`TODO.md`](TODO.md)).

### Creating a note

**New** at the top of the note list opens a composer in the list's own pane: a folder picker and a
textarea. It is the same writer WhatsApp capture uses, minus the command parsing, so a note typed
here and a note captured on a phone are the same shape of file — the first line becomes the title,
`#hashtags` become frontmatter tags, and the filename is `YYYY-MM-DD-slug.md`.

- **Create** (`Cmd/Ctrl+Enter`) files the note and opens it in the viewer; **Cancel** (`Esc`) drops
  the draft. Enter on its own is a newline, as it is in any textarea.
- The folder starts where the list is looking (or Inbox when it is showing all), because a new note
  usually belongs where you already are.
- A failed create keeps the draft and shows the daemon's own sentence, exactly as a failed save does.
  Nothing typed is lost to a daemon that went away.
- The note is stamped `source: desktop`, so the viewer can tell it apart from a capture.
- With the daemon down the button is disabled and its tooltip says why: the demo vault is not a
  vault, and there is nothing behind it to write to.
- Covered by `src/components/NoteComposer.test.tsx` (the folder list, the create, the failure keeping
  the draft, the shortcut, one create at a time, cancel) and by the daemon's route tests.

### Editing a note

**Edit** in the note header turns the body into a plain textarea. Markdown is edited as text on
purpose: the vault is the file, and a rendered editor would have to round-trip syntax the user never
wrote.

- **Save** (`Cmd/Ctrl+S`) writes the body and goes back to the rendered note; **Cancel** (`Esc`)
  drops the draft. The toolbar says when there is something unsaved.
- A failed save keeps the draft and shows the daemon's own sentence — `unknown folder`, a missing
  note, an unreachable daemon — instead of a status code. Losing typing to a failure would be the
  one unforgivable outcome here, so the editor owns its draft until the daemon accepts it.
- Only the body is written. The frontmatter block is left exactly as the file has it, so a note with
  a broken block keeps showing its reasons above the body rather than being repaired behind the
  user's back. A tag or a status is edited in the strip above the body (see **Tags and status**),
  and the fields no control here owns — `created`, `url`, the folder — are not offered as inputs
  that would silently do nothing.
- After a save the listing, the folder counts and the graph are read again, because a new heading
  changes the title, a new `#tag` changes the tags and a new `[[link]]` changes the graph. The list
  row therefore shows the new title without a reload. If that refresh fails, the status bar says so:
  the save landed, and saying "save failed" would be a lie.
- With the daemon down the button is disabled and its tooltip says why, because there is nothing to
  save to; the demo vault is still readable.
- The draft belongs to the note that was open. Opening another note closes the editor and drops what
  was typed — [LIMITATIONS.md](LIMITATIONS.md) names that, and the missing undo and conflict
  handling, rather than implying they exist.
- Covered by `src/components/NoteEditor.test.tsx` (draft, save, failure, shortcut, one save at a
time, cancel) and an SSR render in `src/components/NoteViewer.test.tsx` for the button being offered
only while the daemon answers.

### Preview beside the editor

The editor's right half shows the draft rendered as it is typed, so a table that does not parse or a
fence that swallows the rest of the note is visible before the save rather than after it.

- The preview is `Markdown` (`src/components/Markdown.tsx`), which is the same component the reader
  renders with: one pipeline, one set of plugins, one link override. A second renderer would be a
  second set of rules, and a preview that disagrees with the saved note is worse than none.
- It follows the textarea on every keystroke and scrolls on its own, so the draft and the rendering
  keep their own places. No scroll sync: the two panes are read for different things, and the
  preview's height has nothing to do with the textarea's line count.
- **Hide preview** gives the textarea the whole pane, and **Preview** brings it back; the button
  carries `aria-pressed`, so the state is on the control. The pane starts open: writing Markdown
  blind was the thing the preview was added to fix.
- Below the `md` breakpoint the two panes stack, preview under textarea, because a half-width column
  of prose at that size is unreadable. The app window is normally wider than that.
- An empty or whitespace-only draft says "Nothing to preview yet." rather than showing an empty pane.
- The preview is a rendering of the draft, not a second source of truth: it is never saved, and
  leaving the editor without saving loses it with the rest of the draft.
- Covered by `src/components/NoteEditor.test.tsx`: the rendered heading follows the typing, the
  toggle hides and restores the pane with its `aria-pressed`, and the empty draft says so.

### Tags and status

The strip under the note header is the one edit the body write cannot make: tags and status live in
the frontmatter, and they are what the filters, the graph and the palette read.

- Each tag is a chip with an **×**; a tag is typed into **Add a tag** and sent on `Enter`. Both send
  the whole new list rather than a delta, so two quick edits cannot disagree about what the list is.
- The daemon cleans a tag the way the graph reads one (no `#`, lower-case, trimmed, de-duplicated),
  so `#Rust` typed here and `rust` on a graph node are one tag. Adding one that is already there is a
  no-op, not an error.
- A **Status** picker offers `new`, `active`, `done` and `archived`; a note carrying a status the
  picker does not know keeps it at the top of the list rather than having it rewritten.
- The list, the folder counts and the graph are re-read after a change, because a tag is a chip in
  the list and an edge in the graph. A refresh that fails is a status-bar notice - the edit landed.
- A refusal (a block that does not parse, a daemon that went away) stays in the strip with the
  daemon's sentence and the typed tag still in the field.
- With the daemon down the strip is read-only: the chips are there, the controls are disabled and say
  why.
- Covered by `src/components/NoteMeta.test.tsx`.

### Renaming, moving and deleting

The **...** button in the note header opens a strip under it with **Rename**, **Move** and **Delete**.
Editing the body was the first half of owning a file; this is the rest of it, so a note filed in the
wrong folder or named badly no longer means leaving the app.

- **Rename** starts from the title the note has. The daemon renames the file after the new title -
  `<date>-<slug>.md`, keeping the date prefix - and rewrites the body's first heading, so the header,
  the list row and the filename all say the same thing afterwards. A note with no heading has no
  title of its own (it falls back to the filename), so only the filename changes. Notes that link
  here are rewritten too, so the backlinks survive the rename; the panel says how many there are
  before it happens and the status bar says how many followed ("Renamed; 2 notes link to the new
  title.").
- **Move** offers only the folders the note is not already in, and keeps the filename: the date in it
  belongs to the note, and a move is about where a note belongs, not what it is called. After a move
  the list switches to every folder, because the folder filter you were looking through would
  otherwise hide the note you just moved there.
- **Delete** asks first, naming the note, and says where the file goes. Only the second press sends it.
  The daemon moves it into the vault's `.trash`, and the status bar then offers **Undo** until it is
  dismissed or another delete replaces it: pressing it puts the note back under its old name and opens
  it again. A restore that would land on a note that took the name in the meantime is refused with the
  daemon's sentence, and the trashed copy stays where it is.
- `src/components/StatusBar.test.tsx` covers the notice and its action: the connection label it
  replaces, the action firing, and a notice without one offering nothing.
- Any refusal - a name another note already holds (`409`), a note that is gone (`404`), a daemon that
  went away - keeps the panel open with the daemon's own sentence, because those are things to act
  on rather than a status code to decode.
- After a rename, a move or a delete the listing, the folder counts and the graph are read again: a
  new filename is a new key, and a new heading changes the title the graph draws. If that refresh
  fails the status bar says so - the operation itself landed, and saying it failed would be a lie.
- With the daemon down the button is disabled and its tooltip says why: a demo note has no file
  behind it.
- Covered by `src/components/NoteActions.test.tsx` (the menu, the rename and its refusal, the link
  warning, one rename at a time, the folder list, and the delete that asks) and by the SSR renders in
  `src/components/NoteViewer.test.tsx` for the button being offered only while the daemon answers.

### The trash

A delete's **Undo** only lasts as long as its notice, and that notice is replaced by the next thing
the app has to say. The **Trash** tab in the sidebar is what is left over: every note a delete kept,
read once when the panel opens, newest first, each with its folder and the day and time it went.

- Each entry offers **Restore**, which puts the note back under the name it had and opens it again.
  A restore that would land on a note that took the name in the meantime is refused with the daemon's
  sentence, and the entry stays in the list so the clash can be sorted out and tried again.
- **Empty the trash** is the one action in the app with no undo, so it takes two presses: the button,
  then a confirm that names the cost and offers **Keep them**. Only the second press sends it, and
  the panel closes once it lands, because an empty list is not worth a pane of its own.
- Emptying takes the links those notes carried with it. A `[[wikilink]]` to a note that is gone stays
  in the body as text and the graph drops the edge; nothing resurrects a note to keep a link tidy.
- A refusal - a trash that could not be read, an empty the vault would not take - keeps the panel
  open with the daemon's own sentence and the list as it was.
- The panel is a view like the graph, not a note, so **Close** puts the list back exactly as it was.
- Covered by `src/components/TrashPanel.test.tsx`: the listing and its empty state, a failed read, a
  restore that lands and one that is refused, the two-step empty, a refused empty that stays open,
  and Close.

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
- A **PDF** link is read the same way, with no new pane: the daemon extracts the document's text into
  the same card, the title comes from the file name, and the text is capped and rendered exactly like
  a page's. What could not be read - an encrypted file, a broken one - arrives as the daemon's
  sentence beside **Retry**, like any other refusal.
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
never reached the renderer. The pane is `React.lazy`-loaded, because 184 kB of canvas renderer is only
needed on its own tab (the syntax highlighter is the larger cost now, and it is on the notes path),
and wrapped in `PaneBoundary` so a failed chunk shows an error with a retry instead of a blank
screen.

The `--color-graph-*` tokens are declared as plain custom properties in `:root` rather than Tailwind
theme entries: Tailwind prunes theme values it cannot see used in a class name, so palette steps
referenced only from TypeScript would never reach the stylesheet.

The pure parts are tested: the layout memory (`src/lib/graph-layout.test.ts`, 12 cases) and the
neighbourhood and backlink rules in `@lumos/vault-utils`. The canvas itself has no test - it draws
through the graph library and needs a real renderer, not jsdom - so a tab switch is checked by hand.

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
  workspace has its own `test` script, so `pnpm --filter desktop test` checks it, together with the
  component tests over the sidebar, the note list, the palette and the link pane.
- The offline demo notes carry the same tags their bodies declare (`src/lib/demo.ts`), so the chips
  and the filter work with the daemon stopped; `demo.test.ts` keeps the listing and the bodies in
  step.

## Planned structure

- **Shell**: Tauri 2.x (Rust backend) hosting a Vite + React frontend.
- **UI**: Tailwind CSS + shadcn/ui, dark minimal theme (see [`design.md`](design.md)).
- **Routing**: TanStack Router ✅ - one route at `/`; the panes ride on search parameters (`src/router.tsx`).
- **State**: zustand ✅ - the vault index and the list's filters live in `src/lib/store.ts`; the pane and the open note stay in the address, and session-only UI state stays in the component.
- **Rendering**: `react-markdown` + `remark-gfm` for notes, `force-graph` for the link graph and
  `fuse.js` for search (all in use); `lucide-react` for icons (planned).

## Layout

A three-pane shell, with the list column resizable:

```
┌───────────┬────────────────────╥────────────────────────────┐
│ Sidebar   │ Notes list         ║ Note viewer                │
│ (folders) │ (sorted by date)   ║ (Markdown rendered)        │
└───────────┴────────────────────╨────────────────────────────┘
```

The ║ between the list and the viewer is `PaneSplitter`: drag it, double-click it to reset, or focus
it and use `←`/`→` for a 16px step and `Home` for the default 320px. It is a real `separator` with
`aria-valuemin`/`max`/`now` and a pixel `aria-valuetext`, because a control that only works with a
mouse is not finished. The bounds (240-560px) live in `src/lib/pane-size.ts` with the clamping, so
the drag and the keys cannot disagree; the width is held in `App`, which is what keeps it while the
Graph tab has the list unmounted. It is not persisted, so a reload starts at 320px again, and the
sidebar's own width is fixed.

On the **Graph** tab the list and viewer are replaced by the link graph, with its controls in a
header bar above the canvas. The sidebar stays visible in both views.

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

### Frontmatter warnings

A note whose frontmatter block has a problem stays in the list and stays readable. The daemon reads
the body anyway and returns the reasons as `problems` (see [vault.md](vault.md) for the rules), and
the desktop shows them twice: a `! frontmatter` chip on the row, with every reason in its tooltip,
and a box above the note body that says how many there are and names each one. It is a warning, not
an error state - the markdown below it renders normally, because a broken `created` is no reason to
refuse to read what you wrote. Nothing is repaired on disk, so the file keeps the value that is
wrong and the note sorts by it until it is fixed.

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
- `j` / `k` - move down and up the note list, in the Notes view only. It stops at both ends rather
  than wrapping, and stands down while a field has focus (the list search, the palette) or while the
  palette is open, so `j` stays a letter where a letter is expected. A step through the list is an
  ordinary pick, so it also counts as a recent note.
- `Cmd/Ctrl+S` - save the note being edited. `Esc` cancels that edit and drops the draft; neither does
  anything to a note that is not being edited.
- `Cmd/Ctrl+Enter` - file the note being composed. `Esc` closes the composer and drops what was typed.

## Planned capabilities

Nothing from the shell's planned stack is left unwired: TanStack Router ✅ and zustand ✅ both landed 2026-10-24. `lucide-react` for the icons remains open.

Everything else in the Keyboard section above is wired, and an untyped palette already lists the
notes opened this session.
