# Design System

Lumos uses a dark, minimal interface in the spirit of shadcn/ui: near-black surfaces, thin borders,
high-contrast text, and a restrained accent. No gradients, no heavy shadows, no vibrant color.

## Principles

1. **Content first** - notes are the focus; chrome recedes.
2. **Quiet by default** - one accent, used sparingly.
3. **Consistent spacing** - a 4px grid (`0.25rem` increments).
4. **Legible type** - generous line-height, clear hierarchy.

## Color tokens (dark)

shadcn/ui uses HSL custom properties. These are the dark-theme values, tuned toward near-black:

```css
--background: 0 0% 3.9%;        /* ~#0a0a0a */
--foreground: 0 0% 98%;
--card: 0 0% 3.9%;
--card-foreground: 0 0% 98%;
--popover: 0 0% 3.9%;
--popover-foreground: 0 0% 98%;
--primary: 0 0% 98%;
--primary-foreground: 0 0% 9%;
--secondary: 0 0% 14.9%;
--secondary-foreground: 0 0% 98%;
--muted: 0 0% 14.9%;
--muted-foreground: 0 0% 63.9%;
--accent: 0 0% 14.9%;
--accent-foreground: 0 0% 98%;
--destructive: 0 62.8% 30.6%;
--destructive-foreground: 0 0% 98%;
--border: 0 0% 14.9%;
--input: 0 0% 14.9%;
--ring: 0 0% 83.1%;
--radius: 0.5rem;
```

Use `hsl(var(--token))` (or the shadcn Tailwind aliases such as `bg-background`, `text-muted-foreground`)
rather than hard-coded colors.

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

Resizable three-pane shell:

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
- Full keyboard navigation, including the `Cmd/Ctrl+K` search modal.
