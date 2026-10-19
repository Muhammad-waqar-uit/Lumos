import { describe, expect, it } from "vitest";
import {
  asHttpUrl,
  decodeEntities,
  extractPreview,
  firstExternalLink,
  parseLinkMedia,
} from "./link";

describe("parseLinkMedia - YouTube", () => {
  it("reads a watch URL and points the player at the no-cookie host", () => {
    const media = parseLinkMedia("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(media).toEqual({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      kind: "youtube",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      poster: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
  });

  it("reads the short, shorts, embed, live and music shapes", () => {
    const id = "dQw4w9WgXcQ";
    for (const raw of [
      `https://youtu.be/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/live/${id}`,
      `https://music.youtube.com/watch?v=${id}`,
    ]) {
      expect(parseLinkMedia(raw)?.embedUrl).toBe(`https://www.youtube-nocookie.com/embed/${id}`);
    }
  });

  it("keeps extra query parameters out of the player URL", () => {
    const media = parseLinkMedia("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL1");
    expect(media?.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("treats a channel or playlist page as a page, not a video", () => {
    for (const raw of [
      "https://www.youtube.com/@somechannel",
      "https://www.youtube.com/playlist?list=PL1",
      "https://www.youtube.com/watch?v=too-short",
    ]) {
      expect(parseLinkMedia(raw)?.kind).toBe("page");
    }
  });
});

describe("parseLinkMedia - other kinds", () => {
  it("reads Vimeo in both shapes", () => {
    for (const raw of ["https://vimeo.com/123456789", "https://player.vimeo.com/video/123456789"]) {
      const media = parseLinkMedia(raw);
      expect(media?.kind).toBe("vimeo");
      expect(media?.embedUrl).toBe("https://player.vimeo.com/video/123456789");
    }
  });

  it("recognises an image by extension, even with a query string", () => {
    expect(parseLinkMedia("https://example.com/diagram.PNG")?.kind).toBe("image");
    expect(parseLinkMedia("https://example.com/photo.jpeg?w=400")?.kind).toBe("image");
  });

  it("falls back to a page for a normal article", () => {
    const media = parseLinkMedia("https://example.com/blog/post");
    expect(media?.kind).toBe("page");
    expect(media?.embedUrl).toBeUndefined();
  });

  it("returns null for schemes the app must not open", () => {
    for (const raw of [
      "mailto:me@example.com",
      "file:///C:/secrets.txt",
      "javascript:alert(1)",
      "not a url",
    ]) {
      expect(parseLinkMedia(raw)).toBeNull();
    }
  });

  it("skips a channel page on a lookalike host", () => {
    expect(parseLinkMedia("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ")?.kind).toBe(
      "page",
    );
  });
});

describe("parseLinkMedia - Instagram", () => {
  it("turns a reel into the captioned embed, in a portrait frame", () => {
    expect(parseLinkMedia("https://www.instagram.com/reel/DN035iN2Dum/")).toEqual({
      url: "https://www.instagram.com/reel/DN035iN2Dum/",
      kind: "instagram",
      embedUrl: "https://www.instagram.com/p/DN035iN2Dum/embed/captioned/",
      frame: "portrait",
    });
  });

  it("accepts every permalink shape, including one under the account name", () => {
    const code = "DN035iN2Dum";
    for (const raw of [
      `https://instagram.com/p/${code}/`,
      `https://www.instagram.com/reel/${code}/`,
      `https://m.instagram.com/tv/${code}/`,
      `https://www.instagram.com/zcairns/reel/${code}/`,
    ]) {
      expect(parseLinkMedia(raw)?.embedUrl).toBe(
        `https://www.instagram.com/p/${code}/embed/captioned/`,
      );
    }
  });

  it("leaves a profile, the feed, an empty permalink and a lookalike host as pages", () => {
    for (const raw of [
      "https://www.instagram.com/zcairns/",
      "https://www.instagram.com/reels/",
      "https://www.instagram.com/p/",
      "https://instagram.com.evil.example/reel/DN035iN2Dum",
    ]) {
      expect(parseLinkMedia(raw)?.kind).toBe("page");
    }
  });
});

describe("parseLinkMedia - Facebook", () => {
  it("plays a video through the plugin player, in the default frame", () => {
    const raw = "https://www.facebook.com/watch/?v=10153231379946729";
    const media = parseLinkMedia(raw);
    expect(media?.kind).toBe("facebook");
    expect(media?.embedUrl).toBe(
      `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(raw)}&show_text=false&width=560`,
    );
    expect(media?.frame).toBeUndefined();
  });

  it("reads the page video, slugged video, reel and video.php shapes", () => {
    for (const raw of [
      "https://www.facebook.com/facebook/videos/10153231379946729/",
      "https://www.facebook.com/facebook/videos/how-to-share/10153231379946729/",
      "https://www.facebook.com/reel/1234567890",
      "https://www.facebook.com/video.php?v=10153231379946729",
      "https://m.facebook.com/watch/?v=10153231379946729",
    ]) {
      expect(parseLinkMedia(raw)?.embedUrl).toContain("/plugins/video.php?href=");
    }
  });

  it("gives a post the taller card that keeps its caption", () => {
    for (const raw of [
      "https://www.facebook.com/facebook/posts/10153231379946729",
      "https://www.facebook.com/facebook/photos/a-title/10153231379946729/",
      "https://www.facebook.com/photo.php?fbid=10153231379946729",
      "https://www.facebook.com/permalink.php?story_fbid=10153231379946729&id=20531316728",
    ]) {
      const media = parseLinkMedia(raw);
      expect(media?.embedUrl).toContain("/plugins/post.php?href=");
      expect(media?.frame).toBe("tall");
    }
  });

  it("leaves a profile, a share link, a short link and a lookalike host as pages", () => {
    for (const raw of [
      "https://www.facebook.com/facebook/",
      "https://www.facebook.com/share/r/AbCdEfGhIj/",
      "https://fb.watch/abc123/",
      "https://facebook.com.evil.example/watch/?v=10153231379946729",
    ]) {
      expect(parseLinkMedia(raw)?.kind).toBe("page");
    }
  });

  it("refuses a path that only looks like a video", () => {
    for (const raw of [
      "https://www.facebook.com/facebook/videos/",
      "https://www.facebook.com/watch/?v=not-a-number",
      "https://www.facebook.com/reel/short",
    ]) {
      expect(parseLinkMedia(raw)?.kind).toBe("page");
    }
  });
});

describe("extractPreview", () => {
  const page = [
    "<html><head>",
    "<title>Fallback &amp; title</title>",
    '<meta property="og:title" content="Real &amp; title">',
    '<meta property="og:site_name" content="Example Blog">',
    '<meta property="og:description" content="A short summary.">',
    '<meta property="og:image" content="https://example.com/lead.png">',
    "<style>body { color: red }</style>",
    "</head><body>",
    "<nav>Home About</nav>",
    "<article>",
    "<h1>Heading</h1>",
    "<p>First paragraph with an &mdash; em dash and &#39;quotes&#39;.</p>",
    "<script>console.log('track me')</script>",
    "<p>Second paragraph.</p>",
    "</article>",
    "<footer>Footer text</footer>",
    "</body></html>",
  ].join("\n");

  it("prefers og tags and keeps the title fallback for a page without them", () => {
    const preview = extractPreview(page);
    expect(preview.title).toBe("Real & title");
    expect(preview.site).toBe("Example Blog");
    expect(preview.description).toBe("A short summary.");
    expect(preview.image).toBe("https://example.com/lead.png");

    const bare = extractPreview(
      "<html><head><title>Only a title</title></head><body>x</body></html>",
    );
    expect(bare.title).toBe("Only a title");
    expect(bare.site).toBeNull();
    expect(bare.description).toBeNull();
  });

  it("reads the article body only, with tags and entities resolved", () => {
    const { text } = extractPreview(page);
    expect(text).toContain("Heading");
    expect(text).toContain("First paragraph with an — em dash and 'quotes'.");
    expect(text).toContain("Second paragraph.");
    expect(text).not.toContain("track me");
    expect(text).not.toContain("color: red");
    expect(text).not.toContain("Home About");
  });

  it("puts block elements on their own lines without stacking blank lines", () => {
    const { text } = extractPreview("<body><div>one</div><div>two</div><br>three</body>");
    expect(text.split("\n").filter((line) => line !== "")).toEqual(["one", "two", "three"]);
    expect(text).not.toMatch(/\n{3,}/);
  });

  it("collapses a run of blank lines into one break", () => {
    const { text } = extractPreview("<body><p>a</p>\n\n\n\n<p>b</p></body>");
    expect(text).toBe("a\n\nb");
  });

  it("caps long text and says it did", () => {
    const long = `<body><p>${"x".repeat(500)}</p></body>`;
    const preview = extractPreview(long, { limit: 100 });
    expect(preview.truncated).toBe(true);
    expect(preview.text).toHaveLength(100);

    const short = extractPreview("<body><p>short</p></body>", { limit: 100 });
    expect(short.truncated).toBe(false);
  });

  it("falls back to the body when there is no article or main", () => {
    const { text } = extractPreview("<body><p>just a body</p></body>");
    expect(text).toBe("just a body");
  });

  it("returns empty fields for HTML that says nothing", () => {
    const preview = extractPreview("<html><body></body></html>");
    expect(preview.title).toBeNull();
    expect(preview.text).toBe("");
    expect(preview.truncated).toBe(false);
  });
});

describe("decodeEntities", () => {
  it("decodes named, decimal and hex entities", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &#39;d&#39; &#x27;e&#x27;")).toBe(
      "a & b <c> 'd' 'e'",
    );
  });

  it("leaves an unknown entity alone", () => {
    expect(decodeEntities("&notarealentity; &amp;")).toBe("&notarealentity; &");
  });
});

describe("firstExternalLink", () => {
  it("returns the first URL in the body", () => {
    expect(firstExternalLink("Watch this https://youtu.be/dQw4w9WgXcQ later")).toBe(
      "https://youtu.be/dQw4w9WgXcQ",
    );
  });

  it("drops the punctuation that ends the sentence", () => {
    expect(firstExternalLink("Read https://example.com/post.")).toBe("https://example.com/post");
  });

  it("ignores URLs inside code, fences and inline code", () => {
    const body = [
      "```sh",
      "curl https://example.com/from-a-fence",
      "```",
      "Then `https://example.com/from-inline-code` and finally https://example.com/real",
    ].join("\n");
    expect(firstExternalLink(body)).toBe("https://example.com/real");
  });

  it("returns null when the note has no link", () => {
    expect(firstExternalLink("no links here, just prose")).toBeNull();
  });
});

describe("asHttpUrl", () => {
  it("keeps http and https and trims surrounding space", () => {
    expect(asHttpUrl("  https://example.com  ")?.href).toBe("https://example.com/");
    expect(asHttpUrl("http://example.com")?.protocol).toBe("http:");
  });

  it("rejects anything else", () => {
    expect(asHttpUrl("ftp://example.com")).toBeNull();
    expect(asHttpUrl("")).toBeNull();
  });
});
