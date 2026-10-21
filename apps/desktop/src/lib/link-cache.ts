/**
 * A scraped page, kept for the session.
 *
 * Every visit to a note that carries a link used to cost a fetch and a scrape, and in development
 * React StrictMode mounts the effect twice, so even the first visit cost two. This module holds the
 * answer by URL and joins a second caller onto the request already in flight, which covers both
 * cases with one rule.
 *
 * Module scope on purpose: the link pane unmounts whenever the note changes or the tab does, and a
 * cache inside the component would be gone exactly when it is worth having. Nothing is written to
 * disk, so a reload starts empty and a page that changed in between is not pretended to be current.
 */
import type { LinkCard } from "@lumos/shared";
import { getLink } from "./api";

type Entry = { card: LinkCard } | { pending: Promise<LinkCard> };

const cache = new Map<string, Entry>();

/**
 * The card for a URL: from the cache when it is known, joined onto the in-flight request when one
 * exists, and fetched otherwise. A refusal or a network failure is not remembered, so Retry really
 * tries again instead of replaying the same error.
 */
export async function readLinkOnce(
  url: string,
  fetchCard: (url: string) => Promise<LinkCard> = getLink,
): Promise<LinkCard> {
  const hit = cache.get(url);
  if (hit && "card" in hit) return hit.card;

  const pending =
    hit && "pending" in hit
      ? hit.pending
      : fetchCard(url).then(
          (card) => {
            cache.set(url, { card });
            return card;
          },
          (err: unknown) => {
            cache.delete(url);
            throw err;
          },
        );

  cache.set(url, { pending });
  return pending;
}

/**
 * The cached card if there is one, without starting a fetch. The pane reads this at render so a
 * page it already holds never flashes "Reading the page…" on the way back.
 */
export function peekLink(url: string): LinkCard | null {
  const hit = cache.get(url);
  return hit && "card" in hit ? hit.card : null;
}

/** Drop everything, so the next read goes out again. Used by the tests. */
export function clearLinkCache(): void {
  cache.clear();
}
