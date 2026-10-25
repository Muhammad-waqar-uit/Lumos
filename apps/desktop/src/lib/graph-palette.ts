/**
 * Canvas cannot read Tailwind classes, so the graph paints from the same tokens the
 * rest of the UI uses (see `src/index.css`). Each lookup falls back to another token
 * rather than to a hardcoded colour, so the graph follows the theme either way.
 */
export interface GraphPalette {
  edge: string;
  tag: string;
  label: string;
  /** A colour per folder name, in the order the folders were given. */
  folders: ReadonlyMap<string, string>;
}

/** How many folder hues the theme defines; a vault with more folders cycles through them. */
const FOLDER_HUES = 5;

function tokenOf(styles: CSSStyleDeclaration, names: string[]): string {
  for (const name of names) {
    const value = styles.getPropertyValue(name).trim();
    if (value) return value;
  }
  return "";
}

export function readGraphPalette(folderNames: readonly string[]): GraphPalette {
  const styles = getComputedStyle(document.documentElement);
  const hues = Array.from({ length: FOLDER_HUES }, (_, index) =>
    tokenOf(styles, [`--color-graph-folder-${index + 1}`, "--color-foreground"]),
  );
  const fallback = tokenOf(styles, ["--color-muted-foreground"]);

  return {
    edge: tokenOf(styles, ["--color-graph-edge", "--color-border"]),
    tag: tokenOf(styles, ["--color-graph-tag", "--color-muted-foreground"]),
    label: tokenOf(styles, ["--color-foreground", "--color-muted-foreground"]),
    folders: new Map(
      folderNames.map((name, index) => [name, hues[index % hues.length] || fallback]),
    ),
  };
}

/** A folder keeps its hue as the vault grows, because it is keyed off the folder list itself. */
export function folderColor(palette: GraphPalette, folder: string | undefined): string {
  if (!folder) return palette.tag;
  return palette.folders.get(folder) ?? palette.tag;
}
