import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkCard } from "@lumos/shared";
import { clearLinkCache, peekLink, readLinkOnce } from "./link-cache";

function card(url: string): LinkCard {
  return {
    media: { url, kind: "page" },
    title: "A page",
    site: "example.com",
    description: null,
    image: null,
    text: "read me",
    truncated: false,
  };
}

const URL_A = "https://example.com/a";
const URL_B = "https://example.com/b";

beforeEach(() => {
  clearLinkCache();
});

describe("readLinkOnce", () => {
  it("fetches a URL once and answers the second read from the cache", async () => {
    const fetchCard = vi.fn(async (url: string) => card(url));

    const first = await readLinkOnce(URL_A, fetchCard);
    const second = await readLinkOnce(URL_A, fetchCard);

    expect(fetchCard).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("joins a second caller onto the request already in flight", async () => {
    let release: (value: LinkCard) => void = () => {};
    const fetchCard = vi.fn(
      () =>
        new Promise<LinkCard>((resolve) => {
          release = resolve;
        }),
    );

    const one = readLinkOnce(URL_A, fetchCard);
    const two = readLinkOnce(URL_A, fetchCard);
    expect(fetchCard).toHaveBeenCalledTimes(1);

    release(card(URL_A));
    expect(await one).toEqual(await two);
  });

  it("does not remember a failure, so Retry makes a real request", async () => {
    const fetchCard = vi
      .fn<(url: string) => Promise<LinkCard>>()
      .mockRejectedValueOnce(new Error("That link points at this machine."))
      .mockResolvedValueOnce(card(URL_A));

    await expect(readLinkOnce(URL_A, fetchCard)).rejects.toThrow("this machine");
    expect(peekLink(URL_A)).toBeNull();

    await expect(readLinkOnce(URL_A, fetchCard)).resolves.toMatchObject({ title: "A page" });
    expect(fetchCard).toHaveBeenCalledTimes(2);
  });

  it("keeps one entry per URL instead of one per note", async () => {
    const fetchCard = vi.fn(async (url: string) => card(url));

    await readLinkOnce(URL_A, fetchCard);
    await readLinkOnce(URL_B, fetchCard);
    await readLinkOnce(URL_A, fetchCard);

    expect(fetchCard).toHaveBeenCalledTimes(2);
    expect(peekLink(URL_A)?.media.url).toBe(URL_A);
    expect(peekLink(URL_B)?.media.url).toBe(URL_B);
  });
});

describe("peekLink", () => {
  it("is empty before a read and never starts one", () => {
    const fetchCard = vi.fn(async (url: string) => card(url));

    expect(peekLink(URL_A)).toBeNull();
    expect(fetchCard).not.toHaveBeenCalled();
  });

  it("does not report a page that is still being read", async () => {
    const fetchCard = vi.fn(() => new Promise<LinkCard>(() => {}));

    void readLinkOnce(URL_A, fetchCard);

    expect(peekLink(URL_A)).toBeNull();
  });
});

describe("clearLinkCache", () => {
  it("makes the next read fetch again", async () => {
    const fetchCard = vi.fn(async (url: string) => card(url));

    await readLinkOnce(URL_A, fetchCard);
    clearLinkCache();
    expect(peekLink(URL_A)).toBeNull();

    await readLinkOnce(URL_A, fetchCard);
    expect(fetchCard).toHaveBeenCalledTimes(2);
  });
});
