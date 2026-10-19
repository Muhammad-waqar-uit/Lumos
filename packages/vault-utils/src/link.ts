/**
 * @lumos/vault-utils - links: what can be played inline, and what a page says about itself.
 *
 * Pure by design - no filesystem, no network, no DOM. Classifying a link is string work, and
 * reading `<meta>` tags out of HTML is too, so the daemon scrapes with this module and the
 * desktop classifies with the same code when the daemon is down.
 */
import type { LinkCard, LinkMedia } from "@lumos/shared";
import { stripCode } from "./graph";

/** A page's metadata, without the media decision. */
export type PagePreview = Omit<LinkCard, "media" | "finalUrl">;

/** Body text is capped so a novel-length page cannot flood the reader pane. */
export const PREVIEW_TEXT_LIMIT = 6000;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com"]);

const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "fb.com",
  "www.fb.com",
]);

const IMAGE_PATH = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/** YouTube ids are 11 characters of URL-safe base64; anything else is not a video. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const VIMEO_ID = /^[0-9]{6,12}$/;

/** Instagram shortcodes are URL-safe base64 of varying length. */
const INSTAGRAM_CODE = /^[A-Za-z0-9_-]{5,20}$/;

/** Facebook ids are long numeric strings. */
const FACEBOOK_ID = /^[0-9]{6,25}$/;

/** Instagram permalink segments that carry a post, reel or IGTV shortcode. */
const INSTAGRAM_PERMALINKS = new Set(["p", "reel", "reels", "tv"]);

/** Facebook paths whose id arrives in the query string or as the last segment. */
const FACEBOOK_VIDEO_PATHS = new Set(["watch", "video", "video.php", "reel", "reels"]);

const FACEBOOK_POST_PATHS = new Set(["posts", "permalink.php", "photo", "photo.php"]);

/** `/page/videos/<id>`, `/page/photos/<id>` and their slugs. */
const FACEBOOK_MARKERS: Record<string, "video" | "post"> = {
  videos: "video",
  reels: "video",
  posts: "post",
  photos: "post",
};

/** Parse a URL, keeping only the schemes a browser or the daemon may fetch. */
export function asHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    // Not a URL at all: the caller has to treat it as unusable, not as a page.
    return null;
  }
  return url.protocol === "http:" || url.protocol === "https:" ? url : null;
}

/** The video id in a YouTube URL, across the shapes people actually paste. */
function youtubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (!YOUTUBE_HOSTS.has(host)) return null;

  const [first, second] = url.pathname.split("/").filter(Boolean);
  if (first === "watch") {
    const id = url.searchParams.get("v") ?? "";
    return YOUTUBE_ID.test(id) ? id : null;
  }
  if (first && ["shorts", "embed", "live", "v"].includes(first)) {
    return second && YOUTUBE_ID.test(second) ? second : null;
  }
  return null;
}

/** The numeric id in a Vimeo URL. */
function vimeoId(url: URL): string | null {
  if (!VIMEO_HOSTS.has(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const candidate = segments[0] === "video" ? (segments[1] ?? "") : (segments[0] ?? "");
  return VIMEO_ID.test(candidate) ? candidate : null;
}

/** The shortcode in an Instagram permalink, including `/<username>/reel/<code>`. */
function instagramCode(url: URL): string | null {
  if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const at = segments.findIndex((segment) => INSTAGRAM_PERMALINKS.has(segment.toLowerCase()));
  // A permalink sits at the root or one segment in, under the account name.
  if (at === -1 || at > 1) return null;
  const code = segments[at + 1] ?? "";
  return INSTAGRAM_CODE.test(code) ? code : null;
}

/**
 * The id in a Facebook video, reel or post URL, and which of the two it is.
 * Share links (`/share/...`) and `fb.watch` are left alone: their target is only
 * known after a redirect, so they cannot be classified without a request.
 */
function facebookTarget(url: URL): { kind: "video" | "post"; id: string } | null {
  if (!FACEBOOK_HOSTS.has(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const first = (segments[0] ?? "").toLowerCase();
  const query = url.searchParams;
  const last = segments[segments.length - 1] ?? "";

  if (FACEBOOK_VIDEO_PATHS.has(first)) {
    const id = query.get("v") || last;
    return FACEBOOK_ID.test(id) ? { kind: "video", id } : null;
  }
  if (first === "watch" && FACEBOOK_ID.test(query.get("v") ?? "")) {
    return { kind: "video", id: query.get("v") ?? "" };
  }
  if (FACEBOOK_POST_PATHS.has(first)) {
    const id = (first.startsWith("photo") ? query.get("fbid") : query.get("story_fbid")) || last;
    return FACEBOOK_ID.test(id) ? { kind: "post", id } : null;
  }

  for (const [index, segment] of segments.entries()) {
    const kind = FACEBOOK_MARKERS[segment.toLowerCase()];
    if (!kind) continue;
    // The id is the segment after the marker, or the last one when a slug sits between.
    if (index >= segments.length - 1 || !FACEBOOK_ID.test(last)) return null;
    return { kind, id: last };
  }
  return null;
}

/**
 * Decide how a link should be shown: a player, an image, or a page to scrape.
 * Returns null when the link is not something the app can open at all.
 */
export function parseLinkMedia(raw: string): LinkMedia | null {
  const url = asHttpUrl(raw);
  if (!url) return null;

  const video = youtubeId(url);
  if (video) {
    return {
      url: url.href,
      kind: "youtube",
      // The no-cookie host keeps the player from setting tracking cookies in the app.
      embedUrl: `https://www.youtube-nocookie.com/embed/${video}`,
      poster: `https://i.ytimg.com/vi/${video}/hqdefault.jpg`,
    };
  }

  const vimeo = vimeoId(url);
  if (vimeo) {
    return { url: url.href, kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${vimeo}` };
  }

  const instagram = instagramCode(url);
  if (instagram) {
    return {
      url: url.href,
      kind: "instagram",
      // The captioned embed carries the account and the caption, not just the frame.
      embedUrl: `https://www.instagram.com/p/${instagram}/embed/captioned/`,
      frame: "portrait",
    };
  }

  const facebook = facebookTarget(url);
  if (facebook) {
    const href = encodeURIComponent(url.href);
    return facebook.kind === "video"
      ? {
          url: url.href,
          kind: "facebook",
          embedUrl: `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=560`,
        }
      : {
          url: url.href,
          kind: "facebook",
          // A post keeps its caption and reaction counts, so it needs a taller frame.
          embedUrl: `https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=552`,
          frame: "tall",
        };
  }

  if (IMAGE_PATH.test(url.pathname)) return { url: url.href, kind: "image" };
  return { url: url.href, kind: "page" };
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "\u2014",
  ndash: "\u2013",
  hellip: "\u2026",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  middot: "\u00b7",
};

/** Decode the entities that show up in titles and prose. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1]?.toLowerCase() === "x";
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      const valid = Number.isInteger(code) && code > 0 && code <= 0x10ffff;
      return valid ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Attributes of a single tag, read without a parser (the subset `<meta>` needs). */
function attributesOf(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "").trim();
  }
  return attrs;
}

/** What the page claims about itself, from `<meta>` tags and `<title>`. */
function readHead(html: string): Pick<PagePreview, "title" | "site" | "description" | "image"> {
  const metas = new Map<string, string>();
  for (const match of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const attrs = attributesOf(match[0]);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    const content = attrs.content ?? "";
    if (key && content && !metas.has(key)) metas.set(key, content);
  }

  const meta = (...keys: string[]): string | null => {
    for (const key of keys) {
      const value = metas.get(key);
      if (value) return value;
    }
    return null;
  };

  const tagTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title =
    meta("og:title", "twitter:title") ?? (tagTitle ? decodeEntities(tagTitle).trim() : null);

  return {
    title: title || null,
    site: meta("og:site_name"),
    description: meta("og:description", "twitter:description", "description"),
    image: meta("og:image", "twitter:image"),
  };
}

const BLOCK_END =
  /<(?:\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/tr|\/table|\/section|\/article|\/blockquote|\/pre|\/figure)[^>]*>|<br\s*\/?>/gi;
const DROPPED =
  /<(script|style|noscript|svg|template|iframe|head|nav|footer|form)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Turn an HTML fragment into readable text: block ends become lines, tags and entities go. */
function toText(html: string): string {
  const withoutNoise = html.replace(DROPPED, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const plain = decodeEntities(withoutNoise.replace(BLOCK_END, "\n").replace(/<[^>]*>/g, " "));

  const lines: string[] = [];
  for (const raw of plain.split("\n")) {
    const line = raw.replace(/[ \t\u00a0]+/g, " ").trim();
    // A run of blank lines becomes one break, so prose keeps its paragraphs.
    if (line === "" && (lines.length === 0 || lines[lines.length - 1] === "")) continue;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

/** The part of the page worth reading: `<article>`, else `<main>`, else the body. */
function mainContent(html: string): string {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (article) return article;
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (main) return main;
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
}

/**
 * Read a page's title, description, lead image and body text.
 * Plain string work, so it runs the same in the daemon and in the browser.
 */
export function extractPreview(html: string, options: { limit?: number } = {}): PagePreview {
  const limit = options.limit ?? PREVIEW_TEXT_LIMIT;
  const full = toText(mainContent(html));
  const truncated = full.length > limit;

  return {
    ...readHead(html),
    text: truncated ? full.slice(0, limit).trimEnd() : full,
    truncated,
  };
}

const EXTERNAL_URL = /https?:\/\/[^\s<>()[\]"'`]+/g;

/** Trailing punctuation is almost never part of a URL someone typed in prose. */
function trimTrailing(url: string): string {
  return url.replace(/[.,;:!?]+$/, "");
}

/**
 * The first link written in a note body, so a note captured from WhatsApp can be
 * played or read without leaving the app. Code blocks are ignored, as in the graph.
 */
export function firstExternalLink(content: string): string | null {
  for (const match of stripCode(content).matchAll(EXTERNAL_URL)) {
    const candidate = trimTrailing(match[0]);
    if (asHttpUrl(candidate)) return candidate;
  }
  return null;
}
