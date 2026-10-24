import type { VaultEntry } from "@lumos/shared";
import { saveNote, searchNotes } from "@lumos/vault-utils";
import { parseMessage } from "./commands.js";
import { buildPlan, type PlanOptions } from "./plan.js";

const HELP = [
  "Commands:",
  "/idea <text>",
  "/interview <link or text>",
  "/goal <text>",
  "/read <link>",
  "/plan today | tomorrow",
  "/find <query>",
  "/help",
  "Anything without a command goes to Inbox.",
].join("\n");

/** How many matches a `/find` reply lists before it counts the rest instead. */
const FIND_LIMIT = 5;

/** Turn search hits into a short reply: title and folder, capped at FIND_LIMIT. */
function formatFind(query: string, hits: VaultEntry[]): string {
  if (hits.length === 0) return `No notes match "${query}".`;
  const shown = hits.slice(0, FIND_LIMIT);
  const hidden = hits.length - shown.length;
  const count = hits.length === 1 ? "1 note" : `${hits.length} notes`;
  const rest = hidden > 0 ? [`and ${hidden} more.`] : [];
  return [
    `Found ${count} for "${query}":`,
    ...shown.map((hit) => `- ${hit.title} (${hit.folder})`),
    ...rest,
  ].join("\n");
}

/** What the caller hands the handler for `/plan`; absent, the plan module's own defaults apply. */
export interface HandleOptions {
  plan?: PlanOptions;
}

/**
 * Answer one inbound message. The vault arrives as an argument rather than from module
 * state, so a caller decides where the note lands - the daemon passes its own vault, and
 * a test passes a temporary one. The same goes for the Ollama `/plan` talks to.
 */
export async function handleMessage(
  text: string,
  vaultDir: string,
  options: HandleOptions = {},
): Promise<string> {
  const parsed = parseMessage(text);
  switch (parsed.kind) {
    case "note": {
      if (!parsed.text && !parsed.url) return "Add some text or a link after the command.";
      const { title } = await saveNote(vaultDir, parsed);
      return `Filed in ${parsed.folder}: ${title}`;
    }
    case "plan":
      return buildPlan(vaultDir, parsed.when, options.plan);
    case "find": {
      const query = parsed.query.trim();
      if (!query) return "Usage: /find <query>";
      return formatFind(query, await searchNotes(vaultDir, query));
    }
    case "help":
      return HELP;
    case "unknown":
      return `Unknown command /${parsed.command}\n\n${HELP}`;
  }
}
