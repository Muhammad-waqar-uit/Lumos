# Design System

Lumos uses a dark, minimal interface in the spirit of shadcn/ui: near-black surfaces, thin borders,
high-contrast text, and a restrained accent. No gradients, no heavy shadows, no vibrant color.

## Principles

1. **Content first** - notes are the focus; chrome recedes.
2. **Quiet by default** - one accent, used sparingly.
3. **Consistent spacing** - a 4px grid (`0.25rem` increments).
4. **Legible type** - generous line-height, clear hierarchy.

## Color tokens (dark)

The tokens live in one place, `apps/desktop/src/index.css`, under Tailwind v4's `@theme`, which
turns each one into a custom property *and* a utility class. Values are complete `hsl()` colours
rather than the bare `H S% L%` triplets shadcn/ui uses, because Tailwind v4 does not wrap the value
in `hsl()` for you.

```css
@theme {
  --color-background: hsl(0 0% 3.9%);        /* ~#0a0a0a */
  --color-foreground: hsl(0 0% 98%);
  --color-card: hsl(0 0% 5.5%);
  --color-card-foreground: hsl(0 0% 98%);
  --color-popover: hsl(0 0% 5.5%);
  --color-popover-foreground: hsl(0 0% 98%);
  --color-primary: hsl(0 0% 98%);
  --color-primary-foreground: hsl(0 0% 9%);
  --color-secondary: hsl(0 0% 14.9%);
  --color-secondary-foreground: hsl(0 0% 98%);
  --color-muted: hsl(0 0% 14.9%);
  --color-muted-foreground: hsl(0 0% 63.9%);
  --color-accent: hsl(0 0% 14.9%);
  --color-accent-foreground: hsl(0 0% 98%);
  --color-border: hsl(0 0% 14.9%);
  --color-input: hsl(0 0% 14.9%);
  --color-ring: hsl(0 0% 83.1%);
  --radius-lg: 0.5rem;
}
```

Use the generated utilities (`bg-background`, `text-muted-foreground`, `border-border`) or
`var(--color-…)` in hand-written CSS, rather than a hard-coded colour.

A `--destructive` pair was specified here, but nothing destructive exists yet, so it is not declared
— an unused token is a lie the stylesheet tells. The first piece of UI that deletes something should
add it back.

The graph view is the exception: a canvas cannot use a utility class. Its colours are plain custom
properties on `:root` (`--color-graph-edge`, `--color-graph-tag`, `--color-graph-folder-1` … `-5`),
read at runtime by `src/lib/graph-palette.ts`. They are deliberately *not* `@theme` entries: Tailwind
prunes theme values it cannot see used in a class name, so a token referenced only from TypeScript
would never reach the stylesheet.

## Typography

- **Font**: system UI stack (`ui-sans-serif`, `system-ui`, `-apple-system`, `Segoe UI`, `Roboto`, ...).
- **Mono**: system mono stack for code.
- **Scale**: 12 / 14 / 16 / 18 / 20 / 24 / 30 (px), leaning on 14-16px for body text.
- **Line-height**: 1.5 for body, 1.25 for headings.

## Spacing

4px base grid: `1 = 0.25rem`, `2 = 0.5rem`, `3 = 0.75rem`, `4 = 1rem`, `6 = 1.5rem`, `8 = 2rem`.

## Radius & borders

- `--radius: 0.5rem` for cards, inputs, and buttons.
- Borders are 1px at `--border` (a low-contrast gray); avoid shadows for separation.

## Layout

Three-pane shell (resizing is specified here but not wired up yet — see [TODO.md](TODO.md) Phase 4):

```
┌───────────┬────────────────────┬────────────────────────────┐
│ Sidebar   │ Notes list         │ Note viewer                │
│ folders   │ date + preview     │ rendered Markdown          │
└───────────┴────────────────────┴────────────────────────────┘
```

- Sidebar: fixed-ish width, folder list, note counts.
- Notes list: scrollable, keyboard-navigable.
- Viewer: wide, readable measure; frontmatter shown as subtle metadata.

## Interaction

- Subtle transitions only (e.g. 150ms ease on hover/focus).
- Visible focus rings (`--ring`) for accessibility.
- Empty and loading states are explicit, not blank panels.

## Accessibility

- Maintain WCAG AA contrast (the tokens above are chosen for this).
- Never rely on color alone to convey state; pair with text or icons.
- Full keyboard navigation, including the `Cmd/Ctrl+K` search modal (specified, not wired up yet).
