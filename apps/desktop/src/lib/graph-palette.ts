import { FOLDERS } from "@lumos/shared";

/**
 * Canvas cannot read Tailwind classes, so the graph paints from the same tokens the
 * rest of the UI uses (see `src/index.css`). Each lookup falls back to another token
 * rather than to a hardcoded colour, so the graph follows the theme either way.
 */
export interface GraphPalette {
  edge: string;
  tag: string;
  label: string;
  folders: string[];
}

function tokenOf(styles: CSSStyleDeclaration, names: string[]): string {
  for (const name of names) {
    const value = styles.getPropertyValue(name).trim();
    if (value) return value;
  }
  return "";
}

export function readGraphPalette(): GraphPalette {
  const styles = getComputedStyle(document.documentElement);
  return {
    edge: tokenOf(styles, ["--color-graph-edge", "--color-border"]),
    tag: tokenOf(styles, ["--color-graph-tag", "--color-muted-foreground"]),
    label: tokenOf(styles, ["--color-foreground", "--color-muted-foreground"]),
    folders: FOLDERS.map((_, index) =>
      tokenOf(styles, [`--color-graph-folder-${index + 1}`, "--color-foreground"]),
    ),
  };
}

/** A folder keeps its hue as the vault grows, because it is keyed off the folder list. */
export function folderColor(palette: GraphPalette, folder: string | undefined): string {
  const index = folder ? FOLDERS.findIndex((f) => f === folder) : -1;
  if (index === -1 || palette.folders.length === 0) return palette.tag;
  return palette.folders[index % palette.folders.length];
}
