# Desktop

The desktop app is the viewing half of Lumos: a Tauri desktop shell around a React UI that browses
the Markdown vault. It lives in [`apps/desktop`](../apps/desktop).

## Status

The shell supports dark and light themes. Its `Cmd/Ctrl+K` handler runs at the window level, even
when a text field has focus, and WhatsApp pairing opens inside Lumos when the first QR arrives. The app renders a three-pane layout and loads the vault from the daemon (falling
back to demo data when the daemon is offline):

- `src/App.tsx` - the shell: wires the store, the router and the components together; *where you are* (the pane and the open note) comes from the address, not from local state
- `src/router.tsx` - the TanStack Router factory: one route at `/` whose typed search parameters carry `view` and `note`, validated so a hand-edited address cannot smuggle a pane in
- `src/lib/store.ts` - the vault store (zustand): the daemon read with its demo fallback, the re-read after every change, and the list's filters
- `src/lib/bulk.ts` - the bulk helper: one write over many notes with every refusal kept, and the one sentence the status bar shows for it
- `src/components/Sidebar.tsx` - the brand row (mark + wordmark + the avatar button that opens the profile), the Notes/Graph/Stats/Trash view switch (four tabs share 224px, so the insights tab carries the short word), folders with note counts, and **+ New folder**: a name, a `POST /folders`, and the new folder becomes what the list is looking at. A refusal (a name already taken, or one the vault cannot make) keeps the form open with the daemon's sentence. Every folder row also carries **Rename** and **Delete**: rename is an inline field that sends `PATCH /folder` and the row follows the notes to the new name; delete asks first ("Remove Movies? The 12 notes inside move to Inbox."), sends `DELETE /folder`, and the Inbox becomes what the list is looking at. Both are offered only while the daemon answers, because both are daemon writes; with the daemon down the rows are read-only and the app is showing demo data
- `src/components/LumosMark.tsx` - the mark itself, drawn inline in `currentColor` so it takes `--color-brand` from the theme
- `src/components/NoteList.tsx` - searchable note list (title, date, preview, tags), the **New** button that opens the composer, the selection checkboxes with the bulk bar (move, add-tag, archive, clear) they raise, and a windowed row list above 50 notes so a large vault keeps a small DOM
- `src/components/NoteComposer.tsx` - a new note: a folder picker, a textarea, Create, Cancel, and a failure that keeps the draft
- `src/components/NoteViewer.tsx` - note header (folder, date, source, url) + backlinks + link pane + Markdown body, the Edit button that turns the body into the editor, and the **...** button that opens the file operations
- `src/components/NoteEditor.tsx` - the body as a textarea with a live preview of the draft beside it: Save, Cancel, the preview toggle, the unsaved marker and a failure that keeps the draft
- `src/components/NoteMeta.tsx` - the strip under the note header: tag chips with a remove button, a field that adds one, and a status picker; a failure stays on screen and keeps the draft
- `src/components/Markdown.tsx` - the one Markdown renderer, used by the reader and by the editor's preview
- `src/components/NoteActions.tsx` - rename, move and delete for the open note: a menu, a rename field, a folder picker, a delete that asks first, and a failure that keeps the panel open
- `src/components/TrashPanel.tsx` - what a delete kept: every trashed note with its folder and when, a Restore per entry, and an Empty that asks first
- `src/components/InsightsView.tsx` - the vault counted: six figures, then the most-linked notes, the ones with no links or tags, the commonest tags and every folder's size, each row a way in
- `src/components/ProfileView.tsx` - the profile: the name and the line the vault gives itself, up to six pinned notes as cards, the year's calendar square per day with the streaks beside it, and the form that edits the two
- `src/lib/profile.ts` - the profile itself (name, bio, pins) with its validation and pinning rules, and the zustand store that keeps the sidebar's avatar and the pane in step
- `src/components/LinkPane.tsx` - the note's link: video player, image, or scraped reader card; **Open in browser** actions open an isolated in-app webview on desktop
- `src/lib/link-viewer.ts` - URL validation and the Tauri/native-webview vs browser-preview handoff
- `src/components/GraphView.tsx` - canvas link graph (routes, controls, click-to-open)
- `src/components/PaneBoundary.tsx` - error boundary around the lazily loaded graph pane
- `src/components/SearchModal.tsx` - the `Cmd/Ctrl+K` palette: ranked matches, keyboard selection, body matches from the daemon, and the six commands the palette can run itself - new note, new folder, and the graph, stats, trash and profile panes. The shell owns the shortcut so it works even while a field has focus
- `src/components/StatusBar.tsx` - connection state, the search shortcut, the note count, a notice the app needs to say (a save whose refresh failed), and a chip for the WhatsApp link that opens the panel below. The chip is offered while the daemon answers, and it says the link's own state - being able to read notes says nothing about whether a message would be filed
- `src/components/ThemeToggle.tsx` - switches the full shared palette through `data-theme`, persisting plain `light`/`dark` in `localStorage` and reading legacy JSON-quoted values
- `src/components/WhatsAppPanel.tsx` - the WhatsApp link in the app: the state in a sentence with when it began and when a message was last answered, the pairing code drawn in a dark `<pre>` while a phone needs one, and the single button the state allows (Connect or Disconnect). On first QR availability the shell opens this dialog automatically; no terminal or pairing-page route is needed. A failure stays on the panel in the daemon's words; escape or a click outside closes it, and the link is left as it was
- `src/lib/whatsapp.ts` - the words and colours for each state, the sentence a state deserves, which button it can use, and "since 14:32" formatting. Pure, so the status bar and the panel cannot disagree about what `disconnected` means
- `src/lib/capture.ts` - what arrived while the window was open: the notes that were not in the list before, and the one sentence the status bar says about them (`src/lib/capture.test.ts`)
- `src/lib/list-nav.ts` - the arithmetic behind `j`/`k` in the note list, plus the rule for when a key belongs to a field
- `src/lib/api.ts` - daemon client (`/notes`, `/notes/search`, `/folders` for reading and creating folders, `/folder` for renaming and removing one, `/note` for reading, saving, renaming and deleting, `/note/move`, `/trash` for listing, emptying and restoring, `/graph`, `/link`)
- `src/lib/graph-palette.ts` - reads the `--color-graph-*` tokens and maps a folder name to its hue, with a fallback token per lookup. It takes the vault's folder list rather than a fixed one, so a folder made later gets a colour instead of the tag grey
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

### Vault insights

The list shows one folder and the graph shows the shape without numbers, so neither answers "is
this vault actually connected?". The **Stats** tab is that answer: a count of what the vault holds
and a short list of where it is thin.

- Six figures - notes, folders, distinct tags, links (with the unresolved targets beneath), notes
  added this week (with the month beneath), and notes with no links and no tags.
- Four lists follow: **Most linked** (by links pointing in), **Not connected yet** (the graph's own
  `orphan` - nothing links in or out and the note carries no tags), **Tags** by how many notes carry
  them, and **Folders** by size. Each is capped at five rows with the total still printed, so a list
  never silently truncates.
- Every row acts. A note row opens it, a tag row narrows the list to that tag through the same
  handler the chips use, and a folder row looks at that folder the way the sidebar does - so the
  pane is a way into the vault, not a report about it.
- Nothing is requested: `vaultInsights()` counts the listing and the graph that `App.tsx` has
  already loaded, which is why the pane opens instantly and works with the daemon stopped.
- A graph that did not answer is not counted as zero. `linksKnown` is false when `GET /graph` failed,
  and the pane says the link figures and the two note lists are missing rather than printing a `0`
  that would read as "this vault has no links". A demo shell passes the demo graph, because there
  the notes and the graph are the same little vault.
- The grids answer to the **pane**, not to the window (`@container` on the section, `@md:`/`@lg:`
  on the grids): the sidebar and the list take about 540px before this pane begins, so a `sm:` rule
  asked for three figures where a 376px column fits two. Measured at a 376px pane - two columns for
  the figures, one for the lists, no overflow - and at the window's declared minimum of 860x560,
  where the pane is 636px and takes three. `e2e/layout.spec.ts` now asserts both widths in a real
  browser, so swapping `@md:` back to `sm:` fails the suite rather than only looking wrong.
- Growth is counted against the clock, so `vaultInsights()` takes `now` as an argument (defaulting to
  the real one) and its suite injects a fixed date; a note dated in the future or one whose `created`
  will not parse is not counted as recent.
- Covered by `packages/vault-utils/src/insights.test.ts` (the counts, ordering and ties, the row caps with the totals
  still counted, the growth windows, the empty vault) and `src/components/InsightsView.test.tsx` (the
  figures and their source, opening a note, filtering by a tag, the orphan cap and its "and N more",
  the loading and empty states, the unreadable graph); `App.routing.test.tsx` proves the tab writes
  `?view=insights` into the address.

### The profile

The avatar at the top of the sidebar opens the **Profile** pane (`?view=profile`). It is not a fifth
tab: four tabs already share 224px and a fifth would truncate every label, and the avatar is the
control a person looks for anyway.

- **Pinned**, up to six notes, each a card carrying its folder, date, opening lines and tags. The
  card opens the note; **Unpin** beside the title takes it off. **Customize your pins** lists the
  listing under it - newest first, up to fifty - with one **Pin**/**Unpin** per row; once the sixth
  is in the remaining rows are disabled rather than refused on click. A pin whose note was renamed
  or deleted is not drawn, so there is no card that cannot open.
- **The year**, one square per day with a month ruler, a Mon/Wed/Fri row label and a Less/More
  legend. The bands are absolute - one note is the lightest step, five or more the deepest - because
  scaling to the year's busiest day paints a vault of one-note days as brightly as a busy one. A
  year picker offers every year that holds a note, plus this one.
- **Current streak**, **longest**, **active days** and **busiest day** sit beside it, counted from
  the date each note was created. A streak is not broken by today being unfinished, and it counts
  across years - a run that starts on 30 December is still one run in January.
- **Edit profile** gives the vault a name, a one-line bio and a local `@username` display handle.
  The handle is normalized to lowercase letters, numbers and hyphens, but is not an account, globally
  unique identity or sign-in. The avatar takes the name's first letter the moment it is saved.
- **README** is a GitHub-inspired profile introduction: write Markdown, see the rendered preview
  beside it, then save it as part of the local profile. It uses the same safe Markdown renderer as
  notes, including the external-link handling; content is capped at 12,000 characters. Name, bio,
  handle, README and pins live in `localStorage`, not the vault, so the vault stays plain Markdown.
  What is given up: profile preferences do not travel with notes to another machine.
- **Future extension to remember:** consider optional export/import or vault-portable profile data,
  selectable profile themes/sections, and (only if Lumos later gains accounts or sharing) a
  globally unique username and public profile page. Those need deliberate privacy and portability
  decisions; this local README and handle are not a public profile.
- Every figure is computed from the listing the shell already holds, so the pane opens instantly and
  works with the daemon stopped. Calendar arithmetic is `vaultActivity()` in
  `@lumos/vault-utils/profile` - pure, taking `now` as an argument so the suites can pin it, and
  stepping the days through the date constructor rather than by milliseconds so a daylight-saving
  week still has seven squares.
- Covered by `packages/vault-utils/src/profile.test.ts` (the grid's shape, the bands, the month
  labels, the streaks across the year boundary and through today, the unparseable date),
  `src/lib/profile.test.ts` (parsing untrusted stored JSON, the pin limit, persistence) and
  `src/components/ProfileView.test.tsx` (the identity fields, README edit/preview/save, pinning and
  unpinning, a pin whose note is gone, the grid and figures, the empty vault).

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

The reader's **Open in browser**, **Open on [host]** and **Open the image** actions, as well as links
inside Markdown and the note's frontmatter URL, open a separate Lumos webview window, so the note
pane stays put. The native command accepts only credential-free HTTP(S) URLs and applies the same
scheme check to later navigations. Its generated window label is not covered by the app's
capabilities, leaving remote content without Tauri IPC access. In the Vite browser preview the same
action opens a new browser tab. This is the platform webview, not a bundled Chrome: Windows uses
WebView2 (Chromium-based), while macOS and Linux use WebKit. Browser back/forward controls are not
provided yet.

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
neighbourhood and backlink rules in `@lumos/vault-utils`. The component runs in jsdom too
(`src/components/GraphView.test.tsx`), with the renderer replaced by a recorded stand-in: what the
view *tells* the canvas is asserted - the nodes each control hands over, the selection wiring, the
ncounts and the states around it - while the drawing itself needs a real renderer, so where the
simulation puts a node is still checked by hand.

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
  component tests over the sidebar, the note list, the palette, the link pane and the WhatsApp panel.
- The offline demo notes carry the same tags their bodies declare (`src/lib/demo.ts`), so the chips
  and the filter work with the daemon stopped; `demo.test.ts` keeps the listing and the bodies in
  step.

## Planned structure

- **Shell**: Tauri 2.x (Rust backend) hosting a Vite + React frontend.
- **UI**: Tailwind CSS + shadcn/ui, with shared dark and light palettes (see [`design.md`](design.md)).
- **Theme toggle**: The status-bar button changes the document's `data-theme`, applying the same token palette to the full app, and persists plain `light`/`dark` values in `localStorage`. It accepts the earlier JSON-quoted values as well.
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

### Folders come from the vault

The sidebar, the composer's folder picker, the move menus and the graph legend all read one list:
the folders the daemon answers with `GET /folders`, which is the vault's own directories. There is
no fixed set in the app, so a folder made on WhatsApp - `/newfolder Movies` - is in every one of
those menus on the next read, with a count of zero until something is filed in it. Moving a note
offers only folders the vault actually has, so the picker cannot ask for a directory that does not
exist.

The graph legend grows with the vault: the theme defines five folder hues and a sixth folder cycles
back through them, which is why the legend labels each colour rather than relying on it.

### The WhatsApp link

The capture link is the daemon's, so the app only reports what it is told. `App` reads
`GET /whatsapp` once at load and then every 15s, and every 3s while the panel is open - the pairing
code rotates, and a code shown a minute late is a code that scans and does nothing. Both words are
kept apart on purpose:

- The footer's left-hand dot is the **daemon** - can notes be read right now.
- The chip beside the note count is the **link** - would a message be filed right now.

The panel is the only place that acts. It opens automatically the first time the shell sees a
pairing QR, so setup stays inside Lumos; it is never necessary to open the daemon's
pairing page. **Disconnect** stops the daemon answering messages and keeps
the phone linked, so **Connect** needs no code; unlinking stays on the phone, where the account is.
A read that fails while the daemon still answers is not hidden: the panel says the last check failed
rather than showing a state that may no longer be true.

The panel also says when a message was last answered, because `connected` alone cannot tell a link
that is working from one that is up and idle - the socket can be open all day with nothing sent to
it, and that is exactly the case where someone would wonder whether capture still works.

### A capture that arrives while the window is open

Nothing pushes a file written by WhatsApp to the app, so it has to notice. It does that from the
read it was already making: `lastAt` moves when the daemon answers a message, so a change there
pulls the vault again and diffs the listing against what the app held. One new note is named in the
status bar - `New note from WhatsApp: "Plan the week"` - with **Open**; several are counted, with
**Open newest**. Nothing jumps: a capture can land mid-edit, and an app that moves under someone's
hands is worse than one that waits to be asked.

A message that wrote no note (`/find`, `/plan`) costs one re-read and says nothing, because the
diff comes up empty. The cost is the same read the app does after its own writes; the extra
`/notes` traffic only happens when the link reports activity.

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

### The palette runs commands too

Under the notes, and first once the query matches one, the palette offers six commands:

- **New note** - the Notes view comes back with the composer open. The palette is where someone is
  already typing, so writing should not need a trip to the list's **New** button.
- **New folder** - the field becomes a name field, `Enter` makes the folder and the list looks at it,
  `Esc` steps back out to searching. A refusal keeps the name typed with the daemon's sentence under
  it, the same as every other write.
- **Open the graph**, **Open the stats**, **Open the trash**, **Open the profile** - the pane,
  without hunting for the sidebar tab or its avatar. Every pane has one, so a pane added to the
  sidebar cannot be left unreachable here.

With nothing typed the commands sit under the recent notes rather than over them: searching is what
the palette is open for, and a command is one keystroke from the end of the list. Typing puts any
command whose words matched first, so `new folder` is reachable without leaving the keyboard. The
commands are only offered while the daemon answers - a palette that offered a write to the demo
vault would be offering nothing.

## Keyboard

Wired today:

- `Cmd/Ctrl+K` - open or close the search palette, including while a text field has focus.
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
