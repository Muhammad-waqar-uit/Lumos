/**
 * Frontmatter schema checks.
 *
 * A note that cannot be trusted is still a note: it is read with defaults and the problem is
 * reported, because dropping the file from the listing is how a vault quietly loses something the
 * user wrote. These rules look at the parsed mapping rather than a normalised `Frontmatter`, so a
 * missing field can be told apart from one that was filled in with a default.
 *
 * The schema is deliberately small. It checks the fields the app actually relies on - the date it
 * sorts by, the tags it filters with, the source it shows and the link it may play - and lets any
 * other key through, since forward compatibility is the point of frontmatter.
 */

/** True for a YAML mapping, which is the only shape a frontmatter block may have. */
export function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * True for anything the date parser understands.
 *
 * A native YAML timestamp arrives already parsed as a `Date` when a file uses the `!!timestamp`
 * tag, so that shape is accepted too - `normalizeFrontmatter` turns it back into a string.
 */
function isDate(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== "string" || !value.trim()) return false;
  return !Number.isNaN(Date.parse(value));
}

/** True for a list of non-empty names, which is what `tags` has to be. */
function isTagList(value: unknown): boolean {
  return (
    Array.isArray(value) && value.every((tag) => typeof tag === "string" && tag.trim().length > 0)
  );
}

/**
 * Problems with a parsed frontmatter mapping, in the order they are worth fixing. An empty list
 * means the note is fine; one entry per broken field, phrased as `<field> <what is wrong>` so the
 * viewer can show it without knowing which note it belongs to.
 */
export function validateFrontmatter(data: unknown): string[] {
  if (!isMapping(data)) return ["frontmatter is not a mapping"];

  const problems: string[] = [];

  if (!("created" in data) || data.created === null || data.created === "") {
    problems.push("created is missing");
  } else if (!isDate(data.created)) {
    problems.push("created is not a date");
  }

  // A single tag written as a string is accepted, because the listing normalises it to a one-item
  // list; an array with a blank or non-string member is not, since neither can become a tag.
  if (
    "tags" in data &&
    data.tags !== null &&
    typeof data.tags !== "string" &&
    !isTagList(data.tags)
  ) {
    problems.push("tags is not a list of names");
  }

  if ("source" in data && (typeof data.source !== "string" || !data.source.trim())) {
    problems.push("source is not a name");
  }

  if ("url" in data && data.url !== null) {
    const url = data.url;
    if (typeof url !== "string" || !/^https?:\/\/\S+$/i.test(url.trim())) {
      problems.push("url is not an http address");
    }
  }

  return problems;
}
