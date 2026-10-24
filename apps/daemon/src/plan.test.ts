import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi, type Mock } from "vitest";
import { buildPlan } from "./plan";

/** Every test gets its own vault, so titles from one assertion cannot appear in the next. */
const vaults: string[] = [];

async function makeVault(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "lumos-plan-"));
  vaults.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(vaults.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** One note on disk; the day decides its place in the newest-first listing. */
async function put(
  vault: string,
  day: number,
  title: string,
  body = "Plans for it.",
): Promise<void> {
  const dir = path.join(vault, "Inbox");
  await mkdir(dir, { recursive: true });
  const stamp = `2026-10-${String(day).padStart(2, "0")}`;
  const slug = title.toLowerCase().replace(/\s+/g, "-");
  const raw = [
    "---",
    "source: whatsapp",
    `created: ${stamp}T09:00:00.000Z`,
    "tags: [plan-test]",
    "---",
    "",
    `# ${title}`,
    "",
    body,
    "",
  ].join("\n");
  await writeFile(path.join(dir, `${stamp}-${slug}.md`), raw, "utf8");
}

/** The shape `PlanOptions.fetchImpl` asks for, so a mock is assignable without a cast. */
type PlanFetch = (url: string, init: RequestInit) => Promise<Response>;

/** A fetch stand-in that answers with whatever the test needs, recording what it was sent. */
function ollama(answer: () => Response | Promise<Response>): Mock<PlanFetch> {
  return vi.fn<PlanFetch>(async () => answer());
}

const URL_UNDER_TEST = "http://ollama.test:11434";
// Built from local components, so the prompt's day is Oct 24 in every timezone the suite runs in.
const FIXED_NOW = () => new Date(2026, 9, 24, 8, 0, 0);

function ok(text: string): Response {
  return new Response(JSON.stringify({ response: text }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("buildPlan - the request", () => {
  it("sends the vault's newest notes and answers with the model's plan", async () => {
    const vault = await makeVault();
    await put(vault, 21, "Book the flights");
    await put(vault, 22, "Write the spec", "Outline the sections first.");
    const fetchImpl = ollama(() => ok("1. Write the spec\n2. Book the flights"));

    const reply = await buildPlan(vault, "today", {
      fetchImpl,
      url: URL_UNDER_TEST,
      model: "test-model",
      now: FIXED_NOW,
    });

    expect(reply).toBe("1. Write the spec\n2. Book the flights");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [sentUrl, init] = fetchImpl.mock.calls[0] ?? [];
    expect(sentUrl).toBe(`${URL_UNDER_TEST}/api/generate`);

    const body = JSON.parse(String(init?.body)) as {
      model: string;
      stream: boolean;
      prompt: string;
    };
    expect(body.model).toBe("test-model");
    expect(body.stream).toBe(false);
    // The prompt names the day it is planning for, and carries the notes it was given.
    expect(body.prompt).toContain("today");
    expect(body.prompt).toContain("2026-10-24");
    expect(body.prompt).toContain("Write the spec");
    expect(body.prompt).toContain("Book the flights");
    expect(body.prompt).toContain("[Inbox]");
  });

  it("plans tomorrow against tomorrow's date", async () => {
    const vault = await makeVault();
    await put(vault, 22, "Write the spec");
    const fetchImpl = ollama(() => ok("1. Anything"));

    await buildPlan(vault, "tomorrow", {
      fetchImpl,
      url: URL_UNDER_TEST,
      now: FIXED_NOW,
    });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1].body)) as { prompt: string };
    expect(body.prompt).toContain("tomorrow");
    expect(body.prompt).toContain("2026-10-25");
    expect(body.prompt).not.toContain("2026-10-24");
  });

  it("answers an empty vault without waking Ollama", async () => {
    const fetchImpl = ollama(() => ok("should never be asked"));

    const reply = await buildPlan(await makeVault(), "today", {
      fetchImpl,
      url: URL_UNDER_TEST,
    });

    expect(reply).toBe("There are no notes to plan from yet.");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends only the newest twenty notes", async () => {
    const vault = await makeVault();
    for (let day = 1; day <= 22; day += 1) {
      await put(vault, day, `Note ${String(day).padStart(2, "0")}`);
    }
    const fetchImpl = ollama(() => ok("1. Go"));

    await buildPlan(vault, "today", { fetchImpl, url: URL_UNDER_TEST });

    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1].body)) as { prompt: string };
    expect(body.prompt).toContain("Note 22");
    expect(body.prompt).toContain("Note 03");
    expect(body.prompt).not.toContain("Note 01");
    expect(body.prompt).not.toContain("Note 02");
  });
});

describe("buildPlan - when Ollama cannot answer", () => {
  const vaultSetup = async (): Promise<string> => {
    const vault = await makeVault();
    await put(vault, 22, "Write the spec");
    return vault;
  };

  it("says so when nothing is listening, without the socket's own words", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:11434 (internal detail)");
    });

    const reply = await buildPlan(await vaultSetup(), "today", {
      fetchImpl,
      url: URL_UNDER_TEST,
    });

    expect(reply).toBe(
      `${URL_UNDER_TEST} is not answering for Ollama. Start it with: ollama serve`,
    );
    expect(reply).not.toContain("ECONNREFUSED");
  });

  it("separates a timeout from a refusal", async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "TimeoutError";
      throw err;
    });

    const reply = await buildPlan(await vaultSetup(), "today", {
      fetchImpl,
      url: URL_UNDER_TEST,
    });

    expect(reply).toBe("Ollama took too long to answer.");
  });

  it("names the missing model and how to get it", async () => {
    const fetchImpl = ollama(() => new Response("not found", { status: 404 }));

    const reply = await buildPlan(await vaultSetup(), "today", {
      fetchImpl,
      url: URL_UNDER_TEST,
      model: "gemma2:2b",
    });

    expect(reply).toBe(
      'The model "gemma2:2b" is not available. Pull it with: ollama pull gemma2:2b',
    );
  });

  it("reports any other status plainly", async () => {
    const fetchImpl = ollama(() => new Response("boom", { status: 500 }));

    const reply = await buildPlan(await vaultSetup(), "today", { fetchImpl, url: URL_UNDER_TEST });

    expect(reply).toBe("Ollama answered with 500.");
  });

  it("says so when the answer is unreadable", async () => {
    const fetchImpl = ollama(() => new Response("not json at all", { status: 200 }));

    const reply = await buildPlan(await vaultSetup(), "today", { fetchImpl, url: URL_UNDER_TEST });

    expect(reply).toBe("Ollama's answer could not be read.");
  });

  it("says so when the model returns nothing", async () => {
    const fetchImpl = ollama(() => ok("   "));

    const reply = await buildPlan(await vaultSetup(), "today", { fetchImpl, url: URL_UNDER_TEST });

    expect(reply).toBe("The model returned nothing to say.");
  });
});
