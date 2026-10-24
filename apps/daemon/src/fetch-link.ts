/**
 * Fetching a link on the daemon's behalf, so the desktop can show a page without a browser.
 *
 * The URL comes from a request, so it is untrusted like a vault path: only http(s), no
 * credentials in the URL, and nothing that resolves to this machine or a local network.
 * The fetch is bounded in time, redirects and bytes, and the app renders the extracted
 * text rather than the page's own HTML.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { LinkCard, LinkMediaKind } from "@lumos/shared";
import {
  PREVIEW_TEXT_LIMIT,
  asHttpUrl,
  extractPreview,
  parseLinkMedia,
} from "@lumos/vault-utils/link";
import { PdfReadError, extractPdfText } from "./read-pdf.js";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 1_000_000;
/** A PDF is read whole far more often than a page is: 10 MB, against a page's 1 MB. */
const DEFAULT_MAX_PDF_BYTES = 10_000_000;
const DEFAULT_MAX_REDIRECTS = 3;

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const READABLE_TYPES = new Set(["text/html", "application/xhtml+xml", "text/plain"]);
/** Content types that say nothing about the bytes, so the body itself decides what it is. */
const GENERIC_TYPES = new Set(["application/octet-stream", "binary/octet-stream"]);

/** Hostnames that belong to the machine or the local network, whatever they resolve to. */
const LOCAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".home"];

/** Why a link could not be opened. The route turns this into a status code and a message. */
export type LinkErrorCode =
  "unsupported" | "blocked" | "too-many-redirects" | "unreachable" | "not-a-page";

export class LinkFetchError extends Error {
  readonly code: LinkErrorCode;

  constructor(code: LinkErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LinkFetchError";
    this.code = code;
  }
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
type ResolveHost = (host: string) => Promise<string[]>;

export interface FetchLinkOptions {
  /** Injected in tests: keeps the suite offline and deterministic. */
  fetchImpl?: FetchLike;
  resolveHost?: ResolveHost;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

/** `dns.lookup` covers both the A and AAAA answers a request could end up using. */
async function resolveHost(host: string): Promise<string[]> {
  try {
    const records = await lookup(host, { all: true, verbatim: true });
    return records.map((record) => record.address);
  } catch {
    throw new LinkFetchError("unreachable", "That site could not be found.");
  }
}

/**
 * Loopback, private, link-local and otherwise non-public IPv4/IPv6 space.
 * Addresses are compared numerically, so no string prefix trick decides this.
 */
export function isPrivateAddress(address: string): boolean {
  const bare = address.trim().replace(/^\[|\]$/g, "");
  const version = isIP(bare);

  if (version === 4) {
    const octets = bare.split(".").map(Number);
    if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return true; // unparseable: refuse rather than guess
    }
    const [a, b] = octets;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a === 169 && b === 254) return true; // link-local, cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true; // IETF protocol assignments
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast and reserved
    return false;
  }

  if (version === 6) {
    const lower = bare.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    ) {
      return true; // fe80::/10 link-local
    }
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique-local
    if (lower.startsWith("2001:db8")) return true; // documentation range
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }

  return true; // not an IP at all, which callers must treat as blocked
}

/** A hostname that is local by name, before any DNS lookup happens. */
export function isLocalHostname(host: string): boolean {
  const lower = host.trim().toLowerCase().replace(/\.$/, "");
  if (!lower) return true;
  if (lower === "localhost" || lower === "0.0.0.0") return true;
  return LOCAL_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/** Refuse a URL the daemon must not fetch, and look up the host when it is a name. */
export async function assertFetchable(raw: string, resolve: ResolveHost): Promise<string> {
  const url = asHttpUrl(raw);
  if (!url) throw new LinkFetchError("unsupported", "Only http and https links can be opened.");
  if (url.username || url.password) {
    throw new LinkFetchError(
      "unsupported",
      "A link carrying a username or password is not opened.",
    );
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isLocalHostname(host)) {
    throw new LinkFetchError("blocked", "That link points at this machine or the local network.");
  }

  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new LinkFetchError("blocked", "That link points at this machine or the local network.");
    }
    return url.href;
  }

  // A name can resolve anywhere, so every answer has to be public.
  const addresses = await resolve(host);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new LinkFetchError("blocked", "That link points at this machine or the local network.");
  }
  return url.href;
}

async function request(fetchImpl: FetchLike, url: string, timeoutMs: number): Promise<Response> {
  try {
    return await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
        "user-agent": "Lumos/0.1 (local reader; +https://github.com/Muhammad-waqar-uit/Lumos)",
      },
    });
  } catch (err: unknown) {
    const timedOut =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new LinkFetchError(
      "unreachable",
      timedOut ? "That page took too long to answer." : "That page could not be reached.",
    );
  }
}

/**
 * Read at most `maxBytes`, so a huge or endless response cannot exhaust the daemon.
 *
 * Bytes rather than text: a PDF is not decodable as UTF-8, and decoding belongs to the branch
 * that knows what it is holding.
 */
async function readCappedBytes(
  response: Response,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const stream = response.body;
  if (!stream) return { bytes: new Uint8Array(await response.arrayBuffer()), truncated: false };

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    bytes += value.byteLength;
    if (bytes >= maxBytes) {
      truncated = true;
      await reader.cancel();
      break;
    }
  }

  const merged = new Uint8Array(Math.min(bytes, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= merged.length) break;
    const take = Math.min(chunk.byteLength, merged.length - offset);
    merged.set(chunk.subarray(0, take), offset);
    offset += take;
  }
  return { bytes: merged, truncated };
}

function contentType(response: Response): string {
  return (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
}

/** What a content type lets the daemon do before a single byte of the body is read. */
function typeRole(type: string): "text" | "pdf" | "generic" | "refuse" {
  if (type === "" || READABLE_TYPES.has(type)) return "text";
  if (type === "application/pdf") return "pdf";
  if (GENERIC_TYPES.has(type)) return "generic";
  return "refuse";
}

const notAPage = (type: string): LinkFetchError =>
  new LinkFetchError("not-a-page", `That link is not a web page (${type}).`);

/** The five bytes every PDF begins with: `%PDF-`. */
function hasPdfMagic(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/** A page's opening tag, in the first kilobyte where every serializer puts it. */
function looksLikeHtml(bytes: Uint8Array): boolean {
  const head = new TextDecoder().decode(bytes.subarray(0, 1024));
  return /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!doctype\s+html\b|<html\b|<head\b|<body\b)/i.test(head);
}

/** A PDF's card title is its file name; a download endpoint with no name shows the URL instead. */
function pdfTitle(raw: string): string | null {
  const last = new URL(raw).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!/\.pdf$/i.test(last)) return null;
  const name = decodeURIComponent(last).replace(/\.pdf$/i, "");
  return name || null;
}

/** Media the app plays from the URL alone, so the daemon has nothing to read for them. */
const SELF_PLAYING: ReadonlySet<LinkMediaKind> = new Set(["youtube", "vimeo", "image"] as const);

/**
 * The card the desktop renders for one link.
 *
 * A video or an image needs no fetch at all - the app plays it from the URL - which keeps
 * a YouTube link working with the daemon stopped. Everything else is fetched: a page for
 * its readable text, and an Instagram or Facebook link for the caption, site and lead
 * image its public page still publishes. Those two render nothing readable (the body is
 * a JavaScript shell), so their card is metadata above the embed and no text at all.
 */
export async function fetchLinkCard(
  raw: string,
  options: FetchLinkOptions = {},
): Promise<LinkCard> {
  const media = parseLinkMedia(raw);
  if (!media) throw new LinkFetchError("unsupported", "Only http and https links can be opened.");

  if (SELF_PLAYING.has(media.kind)) {
    return {
      media,
      title: null,
      site: null,
      description: null,
      image: media.kind === "image" ? media.url : (media.poster ?? null),
      text: "",
      truncated: false,
    };
  }

  const doFetch: FetchLike = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const resolve: ResolveHost = options.resolveHost ?? resolveHost;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let current = await assertFetchable(media.url, resolve);
  let redirects = 0;
  let response: Response | null = null;

  while (!response) {
    const res = await request(doFetch, current, timeoutMs);

    if (REDIRECT_STATUS.has(res.status)) {
      if (redirects >= maxRedirects) {
        throw new LinkFetchError(
          "too-many-redirects",
          `That link redirected more than ${maxRedirects} times.`,
        );
      }
      redirects += 1;
      const location = res.headers.get("location");
      if (!location) {
        throw new LinkFetchError("unreachable", "That page redirected without a destination.");
      }
      // Every hop is re-checked: a public URL can redirect to a private one.
      const next = await assertFetchable(new URL(location, current).href, resolve);
      await res.body?.cancel();
      current = next;
      continue;
    }

    response = res;
  }

  if (!response.ok) {
    throw new LinkFetchError("unreachable", `That page answered with ${response.status}.`);
  }

  const type = contentType(response);
  const role = typeRole(type);
  // A known non-page is refused before its body is downloaded.
  if (role === "refuse") throw notAPage(type);

  // Bytes first: a PDF cannot be decoded as text, and a file served without a real type is
  // judged by what it contains rather than by a header that said nothing useful.
  const cap = role === "text" ? maxBytes : DEFAULT_MAX_PDF_BYTES;
  const { bytes, truncated: bytesTruncated } = await readCappedBytes(response, cap);
  const finalUrl = current;
  const original = media.url;

  let form: "pdf" | "text";
  if (role === "generic") {
    if (hasPdfMagic(bytes)) form = "pdf";
    else if (looksLikeHtml(bytes)) form = "text";
    else throw notAPage(type);
  } else {
    form = role;
  }

  if (form === "pdf") {
    let text: string;
    try {
      text = await extractPdfText(bytes);
    } catch (err: unknown) {
      // The parser's own words stay out of the pane; the cause rides on the error it becomes.
      if (err instanceof PdfReadError) {
        throw new LinkFetchError("not-a-page", err.message, { cause: err });
      }
      throw err;
    }
    const cut = text.length > PREVIEW_TEXT_LIMIT;
    return {
      media,
      title: pdfTitle(finalUrl),
      site: new URL(finalUrl).hostname,
      description: null,
      image: null,
      text: cut ? text.slice(0, PREVIEW_TEXT_LIMIT).trimEnd() : text,
      truncated: bytesTruncated || cut,
      ...(finalUrl === original ? {} : { finalUrl }),
    };
  }

  const overCap = bytes.length > maxBytes;
  const pageBytes = overCap ? bytes.subarray(0, maxBytes) : bytes;
  const preview = extractPreview(new TextDecoder().decode(pageBytes));
  return {
    media,
    title: preview.title,
    site: preview.site ?? new URL(finalUrl).hostname,
    description: preview.description,
    image: preview.image,
    text: preview.text,
    truncated: preview.truncated || bytesTruncated || overCap,
    ...(finalUrl === original ? {} : { finalUrl }),
  };
}
