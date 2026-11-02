/**
 * @lumos/vault-utils - what a note's text says about reading it.
 *
 * Two questions the viewer asks of every note, answered without rendering anything: what are its
 * sections, and how long is it? Pure and code-fence aware, so a `## ` inside a code block is not a
 * heading and a shell sample is not prose.
 */

/** A heading the Contents list can point at. */
export interface NoteHeading {
  /** 2 or 3 - a note's h1 is already the title above it. */
  level: number;
  /** The heading's text with its inline Markdown removed. */
  text: string;
  /** The id the renderer gives that heading, unique within the note. */
  id: string;
}

/** Words per minute used for the estimate. Deliberately one round figure, not a model. */
export const READING_WORDS_PER_MINUTE = 200;

/** A note's length, as the header reports it. */
export interface ReadingStats {
  words: number;
  /** Whole minutes, never zero for a note with words: "0 min read" would be a lie. */
  minutes: number;
}

/** Remove fenced code blocks, leaving inline code in place for the heading text. */
function withoutFences(content: string): string {
  return content.replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, "");
}

/** Strip the inline Markdown a heading may carry, so its text and its id agree with the renderer. */
function plainText(raw: string): string {
  return raw
    .replace(/\[\[([^\]\n]+?)\]\]/g, (_whole: string, inner: string) =>
      inner.includes("|") ? (inner.split("|")[1] ?? inner) : inner,
    )
    .replace(/!\[([^\]\n]*)\]\([^)\s]+\)/g, "$1")
    .replace(/\[([^\]\n]*)\]\([^)\s]+\)/g, "$1")
    .replace(/`([^`\n]*)`/g, "$1")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A slugger that keeps ids unique within one note.
 *
 * The renderer and the outline each build their own slugger and walk the same headings in the same
 * order, so the second "Notes" in a body becomes `notes-2` in both. Anything that is not a letter,
 * digit, space or hyphen is dropped; a heading with nothing left is `section`, because an id of ""
 * would point at every element.
 */
export function createSlugger(): (heading: string) => string {
  const seen = new Map<string, number>();
  return (heading: string): string => {
    const base =
      heading
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-") || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}

/**
 * The sections of a note, in the order they appear.
 *
 * Only h2 and h3 are listed: the note's h1 is the title the viewer already shows, and h4 and deeper
 * are detail inside a section rather than a way through the note. Fenced code is skipped, so a
 * commented-out `## ` or a shell example cannot appear as a section.
 */
export function outlineOf(content: string): NoteHeading[] {
  const slug = createSlugger();
  const headings: NoteHeading[] = [];

  for (const line of withoutFences(content).split("\n")) {
    const match = /^(#{2,3})\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
    if (!match) continue;
    const text = plainText(match[2]);
    if (!text) continue;
    headings.push({ level: match[1].length, text, id: slug(text) });
  }

  return headings;
}

/**
 * How many words a note holds, and roughly how long it takes to read.
 *
 * Code fences are left out: a sample is read differently from prose, and counting it would make a
 * short note with a long example look unreadable. Words are runs of letters and digits, so Markdown
 * punctuation and link syntax do not inflate the count.
 */
export function readingStats(content: string): ReadingStats {
  const words = withoutFences(content).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
  return {
    words,
    minutes: words === 0 ? 0 : Math.ceil(words / READING_WORDS_PER_MINUTE),
  };
}
