import { describe, expect, it, vi } from "vitest";
import { LinkFetchError, fetchLinkCard, isLocalHostname, isPrivateAddress } from "./fetch-link";

/** A response with the content type most tests need. */
function page(
  body: string,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "content-type": "text/html; charset=utf-8", ...init.headers },
  });
}

/** Never let a test reach the network: DNS is stubbed to a public address by default. */
const publicDns = async (): Promise<string[]> => ["93.184.216.34"];

/** Run a call that has to fail, and hand back the refusal with its type intact. */
async function refusalOf(call: Promise<unknown>): Promise<LinkFetchError> {
  try {
    await call;
  } catch (err: unknown) {
    if (err instanceof LinkFetchError) return err;
    throw err;
  }
  throw new Error("expected the link fetch to be refused");
}

describe("isPrivateAddress", () => {
  it("blocks loopback, private, link-local and reserved ranges", () => {
    for (const address of [
      "127.0.0.1",
      "127.255.255.254",
      "0.0.0.0",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.10",
      "169.254.169.254",
      "100.64.0.1",
      "198.18.0.1",
      "224.0.0.1",
      "::1",
      "::",
      "fe80::1",
      "fd00::1",
      "::ffff:10.0.0.1",
      "not-an-address",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    for (const address of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::1111"]) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });
});

describe("isLocalHostname", () => {
  it("catches the names that mean this machine", () => {
    for (const host of [
      "localhost",
      "LocalHost",
      "app.localhost",
      "printer.local",
      "api.internal",
      "0.0.0.0",
    ]) {
      expect(isLocalHostname(host), host).toBe(true);
    }
  });

  it("leaves real domains alone", () => {
    for (const host of ["example.com", "localhosted.dev", "notlocal.example"]) {
      expect(isLocalHostname(host), host).toBe(false);
    }
  });
});

describe("fetchLinkCard - media needs no fetch", () => {
  it("plays a YouTube link without a request", async () => {
    const fetchImpl = vi.fn();
    const card = await fetchLinkCard("https://youtu.be/dQw4w9WgXcQ", { fetchImpl });

    expect(card.media.kind).toBe("youtube");
    expect(card.media.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(card.image).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(card.text).toBe("");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("shows an image link as the image itself", async () => {
    const fetchImpl = vi.fn();
    const card = await fetchLinkCard("https://example.com/photo.png", { fetchImpl });
    expect(card.media.kind).toBe("image");
    expect(card.image).toBe("https://example.com/photo.png");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("fetchLinkCard - refusals", () => {
  it("refuses a scheme the app cannot open", async () => {
    await expect(fetchLinkCard("file:///etc/hosts")).rejects.toMatchObject({ code: "unsupported" });
    await expect(fetchLinkCard("mailto:me@example.com")).rejects.toMatchObject({
      code: "unsupported",
    });
  });

  it("refuses credentials embedded in the URL", async () => {
    await expect(fetchLinkCard("https://user:secret@example.com/")).rejects.toMatchObject({
      code: "unsupported",
    });
  });

  it("refuses this machine and the local network", async () => {
    const fetchImpl = vi.fn();
    for (const url of [
      "http://localhost:3001/notes",
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://192.168.0.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]/",
      "http://0.0.0.0/",
      "http://internal.local/",
      "http://service.internal/",
    ]) {
      await expect(fetchLinkCard(url, { fetchImpl }), url).rejects.toMatchObject({
        code: "blocked",
      });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a name that resolves into the local network", async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchLinkCard("https://looks-public.example/", {
        fetchImpl,
        resolveHost: async () => ["10.0.0.7", "93.184.216.34"],
      }),
    ).rejects.toMatchObject({ code: "blocked" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a public link that redirects into the local network", async () => {
    const fetchImpl = vi.fn(async () =>
      page("", { status: 302, headers: { location: "http://127.0.0.1:3001/notes" } }),
    );
    await expect(
      fetchLinkCard("https://example.com/", { fetchImpl, resolveHost: publicDns }),
    ).rejects.toMatchObject({ code: "blocked" });
  });

  it("stops after the redirect limit", async () => {
    let hop = 0;
    const fetchImpl = vi.fn(async () => {
      hop += 1;
      return page("", { status: 302, headers: { location: `https://example.com/${hop}` } });
    });
    await expect(
      fetchLinkCard("https://example.com/", { fetchImpl, resolveHost: publicDns, maxRedirects: 2 }),
    ).rejects.toMatchObject({ code: "too-many-redirects" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe("fetchLinkCard - reading a page", () => {
  it("returns the metadata and the body text", async () => {
    const fetchImpl = vi.fn(async () =>
      page(
        [
          "<html><head>",
          '<meta property="og:title" content="A real page">',
          '<meta property="og:site_name" content="Example">',
          '<meta property="og:description" content="What it is about.">',
          '<meta property="og:image" content="https://example.com/lead.png">',
          "</head><body><article><p>Body text.</p></article></body></html>",
        ].join(""),
      ),
    );

    const card = await fetchLinkCard("https://example.com/post", {
      fetchImpl,
      resolveHost: publicDns,
    });
    expect(card.media.kind).toBe("page");
    expect(card.title).toBe("A real page");
    expect(card.site).toBe("Example");
    expect(card.description).toBe("What it is about.");
    expect(card.image).toBe("https://example.com/lead.png");
    expect(card.text).toBe("Body text.");
    expect(card.truncated).toBe(false);
    expect(card.finalUrl).toBeUndefined();
  });

  it("falls back to the host as the site name", async () => {
    const fetchImpl = vi.fn(async () => page("<html><body><p>No tags here.</p></body></html>"));
    const card = await fetchLinkCard("https://news.example.com/story", {
      fetchImpl,
      resolveHost: publicDns,
    });
    expect(card.site).toBe("news.example.com");
    expect(card.title).toBeNull();
  });

  it("follows a public redirect and reports the URL it landed on", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(page("", { status: 301, headers: { location: "/moved" } }))
      .mockResolvedValueOnce(page("<html><body><p>Landed.</p></body></html>"));

    const card = await fetchLinkCard("https://example.com/old", {
      fetchImpl,
      resolveHost: publicDns,
    });
    expect(card.finalUrl).toBe("https://example.com/moved");
    expect(card.text).toBe("Landed.");
  });

  it("accepts a plain text response", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("just text", { headers: { "content-type": "text/plain" } }),
    );
    const card = await fetchLinkCard("https://example.com/notes.txt", {
      fetchImpl,
      resolveHost: publicDns,
    });
    expect(card.text).toBe("just text");
  });

  it("refuses a content type that is not a page, naming it", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("not a page", { headers: { "content-type": "video/mp4" } }),
    );
    const failure = await refusalOf(
      fetchLinkCard("https://example.com/clip.mp4", { fetchImpl, resolveHost: publicDns }),
    );
    expect(failure.code).toBe("not-a-page");
    expect(failure.message).toBe("That link is not a web page (video/mp4).");
  });

  it("reports an error status without a stack trace", async () => {
    const fetchImpl = vi.fn(async () => page("nope", { status: 404 }));
    await expect(
      fetchLinkCard("https://example.com/missing", { fetchImpl, resolveHost: publicDns }),
    ).rejects.toMatchObject({ code: "unreachable", message: "That page answered with 404." });
  });

  it("keeps the underlying network error out of the message", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 93.184.216.34:443 (internal socket detail)");
    });
    const failure = await refusalOf(
      fetchLinkCard("https://example.com/", { fetchImpl, resolveHost: publicDns }),
    );

    expect(failure).toBeInstanceOf(LinkFetchError);
    expect(failure.message).toBe("That page could not be reached.");
    expect(failure.message).not.toContain("ECONNREFUSED");
  });

  it("says so when the page is too slow", async () => {
    const fetchImpl = vi.fn(async () => {
      const abort = new Error("aborted");
      abort.name = "TimeoutError";
      throw abort;
    });
    await expect(
      fetchLinkCard("https://example.com/slow", { fetchImpl, resolveHost: publicDns }),
    ).rejects.toMatchObject({ message: "That page took too long to answer." });
  });

  it("stops reading an oversized body and marks the text truncated", async () => {
    const chunk = new TextEncoder().encode("x".repeat(1000));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 50; i += 1) controller.enqueue(chunk);
        controller.close();
      },
    });
    const fetchImpl = vi.fn(
      async () => new Response(stream, { headers: { "content-type": "text/html" } }),
    );

    const card = await fetchLinkCard("https://example.com/big", {
      fetchImpl,
      resolveHost: publicDns,
      maxBytes: 2048,
    });
    expect(card.truncated).toBe(true);
  });

  it("caps the reader's text length", async () => {
    const fetchImpl = vi.fn(async () =>
      page(`<html><body><p>${"word ".repeat(3000)}</p></body></html>`),
    );
    const card = await fetchLinkCard("https://example.com/long", {
      fetchImpl,
      resolveHost: publicDns,
    });
    expect(card.text.length).toBeLessThanOrEqual(6000);
    expect(card.truncated).toBe(true);
  });
});

/** Assemble PDF objects into a valid file with real xref offsets. */
function buildPdf(objects: string[]): Uint8Array {
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

/** The five objects a one-page PDF needs, drawing `content` on the page. */
function pageObjects(content: string): string[] {
  return [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
}

/**
 * A minimal but valid one-page PDF whose only text is `text`.
 *
 * Built byte by byte rather than pasted as a blob, so the fixture is readable in the test and
 * can carry any sentence the assertions need.
 */
function simplePdf(text: string): Uint8Array {
  return buildPdf(pageObjects(`BT /F1 24 Tf 72 720 Td (${text}) Tj ET`));
}

/**
 * A page full of wrapped lines, past the reader's 6000-character limit.
 *
 * Producers write one text run per visual line, each inside the page box - and the reader only
 * returns text the document draws inside the box - so a single line spanning the page would be a
 * fixture no real PDF is shaped like.
 */
function longPdf(): Uint8Array {
  const lines: string[] = ["BT /F1 12 Tf 40 760 Td"];
  for (let i = 0; i < 100; i += 1) {
    lines.push(`(${"word ".repeat(15)}) Tj`);
    lines.push("0 -7 Td");
  }
  lines.push("ET");
  return buildPdf(pageObjects(lines.join("\n")));
}

function pdfResponse(bytes: Uint8Array, type = "application/pdf"): Response {
  return new Response(bytes, { headers: { "content-type": type } });
}

describe("reading a PDF the same way as a page", () => {
  it("extracts the text, titles it from the file name and stays a page card", async () => {
    const fetchImpl = vi.fn(async () => pdfResponse(simplePdf("Hello from a PDF")));

    const card = await fetchLinkCard("https://example.com/files/annual-report.pdf", {
      fetchImpl,
      resolveHost: publicDns,
    });

    expect(card.text).toContain("Hello from a PDF");
    expect(card.title).toBe("annual-report");
    expect(card.site).toBe("example.com");
    expect(card.media.kind).toBe("page");
    expect(card.truncated).toBe(false);
  });

  it("reads a PDF that arrives as application/octet-stream", async () => {
    const fetchImpl = vi.fn(async () =>
      pdfResponse(simplePdf("Sniffed from raw bytes"), "application/octet-stream"),
    );

    const card = await fetchLinkCard("https://example.com/download?id=9", {
      fetchImpl,
      resolveHost: publicDns,
    });

    expect(card.text).toContain("Sniffed from raw bytes");
  });

  it("reads an HTML file that arrives as application/octet-stream", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("<!doctype html><html><body><p>Served as a file.</p></body></html>", {
          headers: { "content-type": "application/octet-stream" },
        }),
    );

    const card = await fetchLinkCard("https://example.com/page.html", {
      fetchImpl,
      resolveHost: publicDns,
    });

    expect(card.text).toContain("Served as a file.");
  });

  it("refuses a binary it cannot read, naming the type it was served as", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
    const fetchImpl = vi.fn(async () => pdfResponse(png, "application/octet-stream"));

    const failure = await refusalOf(
      fetchLinkCard("https://example.com/blob", { fetchImpl, resolveHost: publicDns }),
    );

    expect(failure.code).toBe("not-a-page");
    expect(failure.message).toBe("That link is not a web page (application/octet-stream).");
  });

  it("says so when a PDF cannot be read, without the parser's own words", async () => {
    const fetchImpl = vi.fn(async () => pdfResponse(new TextEncoder().encode("%PDF-1.7 garbage")));

    const failure = await refusalOf(
      fetchLinkCard("https://example.com/broken.pdf", { fetchImpl, resolveHost: publicDns }),
    );

    expect(failure.code).toBe("not-a-page");
    expect(failure.message).toBe("That PDF could not be read.");
  });

  it("caps a long PDF at the reader's limit and says it was cut", async () => {
    const fetchImpl = vi.fn(async () => pdfResponse(longPdf()));

    const card = await fetchLinkCard("https://example.com/huge.pdf", {
      fetchImpl,
      resolveHost: publicDns,
    });

    expect(card.text.length).toBeLessThanOrEqual(6000);
    expect(card.truncated).toBe(true);
  });
});
