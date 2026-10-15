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
import type { LinkCard } from "@lumos/shared";
import { asHttpUrl, extractPreview, parseLinkMedia } from "@lumos/vault-utils/link";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 1_000_000;
const DEFAULT_MAX_REDIRECTS = 3;

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const READABLE_TYPES = new Set(["text/html", "application/xhtml+xml", "text/plain"]);

/** Hostnames that belong to the machine or the local network, whatever they resolve to. */
const LOCAL_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home.arpa", ".home"];

/** Why a link could not be opened. The route turns this into a status code and a message. */
export type LinkErrorCode =
  "unsupported" | "blocked" | "too-many-redirects" | "unreachable" | "not-a-page";

export class LinkFetchError extends Error {
  readonly code: LinkErrorCode;

  constructor(code: LinkErrorCode, message: string) {
    super(message);
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

/** Read at most `maxBytes`, so a huge or endless response cannot exhaust the daemon. */
async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<{ body: string; truncated: boolean }> {
  const stream = response.body;
  if (!stream) return { body: await response.text(), truncated: false };

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  let truncated = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    body += decoder.decode(value, { stream: true });
    if (bytes >= maxBytes) {
      truncated = true;
      await reader.cancel();
      break;
    }
  }
  body += decoder.decode();

  return { body: truncated ? body.slice(0, maxBytes) : body, truncated };
}

function contentType(response: Response): string {
  return (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
}

/**
 * The card the desktop renders for one link.
 *
 * A video or an image needs no fetch at all - the app plays it from the URL - which keeps
 * a YouTube link working with the daemon stopped. A page is fetched, read, and returned as
 * text plus its metadata.
 */
export async function fetchLinkCard(
  raw: string,
  options: FetchLinkOptions = {},
): Promise<LinkCard> {
  const media = parseLinkMedia(raw);
  if (!media) throw new LinkFetchError("unsupported", "Only http and https links can be opened.");

  if (media.kind !== "page") {
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
  if (type && !READABLE_TYPES.has(type)) {
    throw new LinkFetchError("not-a-page", `That link is not a web page (${type}).`);
  }

  const { body, truncated: bodyTruncated } = await readCapped(response, maxBytes);
  const preview = extractPreview(body);
  const finalUrl = current;
  const original = media.url;

  return {
    media,
    title: preview.title,
    site: preview.site ?? new URL(finalUrl).hostname,
    description: preview.description,
    image: preview.image,
    text: preview.text,
    truncated: preview.truncated || bodyTruncated,
    ...(finalUrl === original ? {} : { finalUrl }),
  };
}
