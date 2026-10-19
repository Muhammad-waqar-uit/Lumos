import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LinkCard, LinkFrame, LinkMedia, LinkMediaKind } from "@lumos/shared";
import { parseLinkMedia } from "@lumos/vault-utils/link";
import { getLink, type Connection } from "../lib/api";

/** What one fetch of a page came back with, and which request it answers. */
type FetchOutcome =
  | { url: string; attempt: number; status: "ready"; card: LinkCard }
  | { url: string; attempt: number; status: "error"; message: string };

/** Where a page fetch is: nothing to do, in flight, done, or refused. */
type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; card: LinkCard }
  | { status: "error"; message: string };

/**
 * The frame each embed needs. A reel is vertical and a Facebook post keeps its caption,
 * so both are sized by height and capped against a short window.
 */
const FRAME_CLASS: Record<LinkFrame, string> = {
  landscape: "aspect-video w-full",
  portrait: "aspect-[9/16] h-[min(80vh,620px)]",
  tall: "h-[min(70vh,600px)] w-full max-w-[560px]",
};

/** Kinds the daemon reads for their metadata. The rest play or render from the URL. */
const FETCHED_KINDS = new Set<LinkMediaKind>(["page", "instagram", "facebook"]);

/** What a daemon-down pane cannot show, which is different for a page and for an embed. */
function offlineText(kind: LinkMediaKind): string {
  return kind === "page"
    ? "Reading the page needs the daemon — it is not running, so only the link is shown."
    : "The caption and thumbnail come from the daemon — it is not running, so only the embed is shown.";
}

/**
 * The pane's state, computed from what the last fetch returned rather than stored:
 * an outcome for another URL, or from a superseded attempt, means "loading".
 */
function derivePage(
  outcome: FetchOutcome | null,
  url: string,
  attempt: number,
  canFetch: boolean,
): PageState {
  if (!canFetch) return { status: "idle" };
  if (!outcome || outcome.url !== url || outcome.attempt !== attempt) return { status: "loading" };
  if (outcome.status === "ready") return { status: "ready", card: outcome.card };
  return { status: "error", message: outcome.message };
}

/** A small link that leaves the app for the real thing. */
function OpenExternal({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-xs text-muted-foreground underline hover:text-foreground"
    >
      {children}
    </a>
  );
}

/** The link's host, for a label that does not need a network call. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** The filename of a linked image, which makes a better alt than the whole URL. */
function nameOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "") || url;
  } catch {
    return url;
  }
}

/**
 * The iframe's accessible name. A Facebook video and a Facebook post are different
 * things; an Instagram permalink is a post, a reel, or an IGTV video, and the embed
 * does not say which, so it is not guessed at.
 */
function embedLabel(media: LinkMedia): string {
  if (media.kind === "instagram") return "Instagram post or reel";
  if (media.kind === "facebook") return media.frame === "tall" ? "Facebook post" : "Facebook video";
  return "Video";
}

/** Title, host, description and lead image - what the page says about itself. */
function PreviewHeader({ card, url }: { card: LinkCard | null; url: string }) {
  return (
    <div className="flex gap-3">
      {card?.image ? (
        <img
          src={card.image}
          alt=""
          loading="lazy"
          className="h-16 w-24 flex-none rounded border border-border object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-medium text-foreground">
          {card?.title ?? hostOf(url)}
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {card?.site ?? hostOf(url)}
          {card?.finalUrl ? " · redirected" : ""}
        </p>
        {card?.description ? (
          <p className="line-clamp-2 mt-1 text-xs text-muted-foreground">{card.description}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One link from a note, shown in place: a player for a video, reel or Facebook post, the
 * image itself for an image, and for anything else the page's title, lead image and
 * readable text.
 *
 * The scrape goes through the daemon, which refuses private hosts and non-page content
 * types. An embed needs no daemon at all, so a reel or a video plays with it stopped -
 * that is why a social link stays playable offline but loses its caption with it.
 */
export function LinkPane({ url, connection }: { url: string; connection: Connection }) {
  const media = useMemo(() => parseLinkMedia(url), [url]);
  const canFetch = Boolean(media && FETCHED_KINDS.has(media.kind) && connection === "daemon");
  const [outcome, setOutcome] = useState<FetchOutcome | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!canFetch) return;
    let alive = true;
    getLink(url).then(
      (card) => {
        if (alive) setOutcome({ url, attempt, status: "ready", card });
      },
      (err: unknown) => {
        if (!alive) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : "That page could not be read by the daemon.";
        setOutcome({ url, attempt, status: "error", message });
      },
    );
    return () => {
      alive = false;
    };
  }, [url, canFetch, attempt]);

  const page = derivePage(outcome, url, attempt, canFetch);

  if (!media) return null;

  const card = page.status === "ready" ? page.card : null;
  const withDaemon = canFetch;

  /** The fetch's own state, shared by the embed and the page layouts. */
  const status = (
    <>
      {!withDaemon && FETCHED_KINDS.has(media.kind) ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {offlineText(media.kind)} <OpenExternal href={url}>Open in browser</OpenExternal>
        </p>
      ) : null}

      {page.status === "loading" ? (
        <p aria-busy="true" className="mt-3 text-xs text-muted-foreground">
          Reading the page…
        </p>
      ) : null}

      {page.status === "error" ? (
        <p className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{page.message}</span>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded border border-border px-2 py-0.5 hover:bg-accent hover:text-foreground"
          >
            Retry
          </button>
        </p>
      ) : null}
    </>
  );

  if (media.embedUrl) {
    return (
      <section aria-label={embedLabel(media)} className="border-b border-border px-6 py-4">
        <div className="flex justify-center">
          <div
            className={`overflow-hidden rounded-md border border-border bg-black ${FRAME_CLASS[media.frame ?? "landscape"]}`}
          >
            <iframe
              src={media.embedUrl}
              title={`${embedLabel(media)} from ${hostOf(url)}`}
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {card ? (
          <div className="mt-3 rounded-md border border-border bg-card p-3">
            <PreviewHeader card={card} url={url} />
          </div>
        ) : null}

        {status}

        <p className="mt-2">
          <OpenExternal href={url}>Open on {hostOf(url)}</OpenExternal>
        </p>
      </section>
    );
  }

  if (media.kind === "image") {
    return (
      <section aria-label="Linked image" className="border-b border-border px-6 py-4">
        <img
          src={media.url}
          alt={nameOf(media.url)}
          loading="lazy"
          className="max-h-80 rounded-md border border-border object-contain"
        />
        <p className="mt-2">
          <OpenExternal href={url}>Open the image</OpenExternal>
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Linked page" className="border-b border-border px-6 py-4">
      <div className="rounded-md border border-border bg-card p-3">
        <PreviewHeader card={card} url={url} />

        {status}

        {card && card.text ? (
          <div className="mt-3 max-h-72 overflow-y-auto border-t border-border pt-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {card.text}
            </p>
            {card.truncated ? (
              <p className="mt-2 text-xs text-muted-foreground">
                The text was cut here. <OpenExternal href={url}>Open the whole page</OpenExternal>
              </p>
            ) : null}
          </div>
        ) : null}

        {card && !card.text ? (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            That page had no readable text. <OpenExternal href={url}>Open in browser</OpenExternal>
          </p>
        ) : null}
      </div>
    </section>
  );
}
