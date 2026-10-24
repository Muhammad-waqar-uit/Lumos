/**
 * @lumos daemon - `/plan`: a short plan for today or tomorrow, from the vault's newest notes.
 *
 * Ollama is the model and this module is the only place that talks to it. Every refusal arrives
 * as a sentence the person can act on - which address, which model, which command - while the
 * underlying error's own words (addresses, errnos, stack frames) stay out of a WhatsApp reply:
 * a reply is the surface here, the same role `LinkFetchError`'s fixed sentences play for `/link`,
 * so there is nothing further to log. What is never shown anywhere is the prompt itself: it is
 * built from note contents, and note contents stay out of the logs.
 */
import type { VaultEntry } from "@lumos/shared";
import { listNotes } from "@lumos/vault-utils";

/** Where Ollama listens when nothing says otherwise. */
export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

/** The model `/plan` asks for. The candidates this was chosen between are in PLAN.md. */
export const DEFAULT_OLLAMA_MODEL = "llama3.2:3b";

/** The newest notes the prompt carries: enough for a day's plan, small enough to stay readable. */
const PLAN_NOTE_LIMIT = 20;

/** Local generation can be slow on a CPU, but a reply that never arrives is worse than a sentence. */
const OLLAMA_TIMEOUT_MS = 60_000;

export interface PlanOptions {
  /** Base address of the daemon, without a path. */
  url?: string;
  /** Model name, as `ollama pull` would name it. */
  model?: string;
  /** Injected by tests so the suite never reaches the network. */
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  /** Injected by tests so the prompt's date is fixed. */
  now?: () => Date;
}

/** The day being planned for, as `YYYY-MM-DD` in the machine's own timezone. */
function dayOf(date: Date, when: "today" | "tomorrow"): string {
  const day =
    when === "tomorrow" ? new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1) : date;
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const numeric = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${numeric}`;
}

/** One note as a line the model can read: title, folder, tags, and the excerpt on the next line. */
function promptLine(note: VaultEntry): string {
  const tags = note.tags.length > 0 ? ` #${note.tags.join(" #")}` : "";
  const excerpt = note.excerpt.replace(/\s+/g, " ").trim();
  const heading = `- ${note.title} [${note.folder}]${tags}`;
  return excerpt ? `${heading}\n  ${excerpt}` : heading;
}

function planPrompt(notes: VaultEntry[], when: "today" | "tomorrow", day: string): string {
  return [
    `Plan for ${when} (${day}).`,
    "These are the newest notes in my vault.",
    "Reply with a plan of at most 5 short points and nothing else.",
    "",
    ...notes.map(promptLine),
  ].join("\n");
}

/**
 * Answer `/plan today | tomorrow`.
 *
 * An empty vault is answered here, without waking the model: there is nothing to plan from and
 * a connection error on top of that would only confuse the reply. Everything the model needs is
 * read before the request, so a failure afterwards still names one clear cause.
 */
export async function buildPlan(
  vaultDir: string,
  when: "today" | "tomorrow",
  options: PlanOptions = {},
): Promise<string> {
  const url = options.url ?? DEFAULT_OLLAMA_URL;
  const model = options.model ?? DEFAULT_OLLAMA_MODEL;
  const fetchImpl = options.fetchImpl ?? ((target, init) => fetch(target, init));

  const notes = (await listNotes(vaultDir)).slice(0, PLAN_NOTE_LIMIT);
  if (notes.length === 0) return "There are no notes to plan from yet.";

  const now = options.now ? options.now() : new Date();
  const prompt = planPrompt(notes, when, dayOf(now, when));

  let res: Response;
  try {
    res = await fetchImpl(`${url}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
    });
  } catch (err: unknown) {
    const timedOut =
      err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    if (timedOut) return "Ollama took too long to answer.";
    return `${url} is not answering for Ollama. Start it with: ollama serve`;
  }

  if (!res.ok) {
    if (res.status === 404) {
      return `The model "${model}" is not available. Pull it with: ollama pull ${model}`;
    }
    return `Ollama answered with ${res.status}.`;
  }

  let parsed: { response?: unknown };
  try {
    parsed = JSON.parse(await res.text()) as { response?: unknown };
  } catch {
    return "Ollama's answer could not be read.";
  }
  if (typeof parsed.response !== "string") return "Ollama's answer could not be read.";

  const text = parsed.response.trim();
  if (!text) return "The model returned nothing to say.";
  return text;
}
