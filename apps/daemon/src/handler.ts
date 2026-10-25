import { folderCommand, type VaultEntry } from "@lumos/shared";
import {
  NoteFileError,
  createFolder,
  listFolderNames,
  saveNote,
  searchNotes,
} from "@lumos/vault-utils";
import { parseMessage } from "./commands.js";
import { buildPlan, type PlanOptions } from "./plan.js";

/** The shorthands worth advertising; any other folder advertises its own name. */
const PREFERRED_COMMAND: Record<string, string> = {
  Ideas: "idea",
  Interviews: "interview",
  Goals: "goal",
  Reading: "read",
};

function commandOf(folder: string): string {
  return PREFERRED_COMMAND[folder] ?? folderCommand(folder);
}

/**
 * The menu, built from the folders the vault has.
 *
 * A folder commands line per command rather than a table, because this arrives as a chat message:
 * one line that can be copied whole beats columns that wrap on a phone.
 */
function helpText(folders: readonly string[]): string {
  return [
    "Lumos - send a command and the message is filed.",
    ...folders.map((folder) => `/${commandOf(folder)} <text or link> -> ${folder}`),
    "/newfolder <name> - then /<name> files into it",
    "/plan today | tomorrow",
    "/find <query>",
    "/help",
    "No command at all -> Inbox.",
  ].join("\n");
}

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
 *
 * The folder list is read from the vault on every message rather than held in the module: a folder
 * made a second ago has to be a command on the next message, and a folder deleted outside the app
 * has to stop being one.
 */
export async function handleMessage(
  text: string,
  vaultDir: string,
  options: HandleOptions = {},
): Promise<string> {
  const folders = await listFolderNames(vaultDir);
  const parsed = parseMessage(text, folders);
  switch (parsed.kind) {
    case "note": {
      if (!parsed.text && !parsed.url) return "Add some text or a link after the command.";
      const { title } = await saveNote(vaultDir, parsed);
      return `Filed in ${parsed.folder}: ${title}`;
    }
    case "newFolder": {
      if (!parsed.name.trim()) return "Usage: /newfolder <name>";
      try {
        const folder = await createFolder(vaultDir, parsed.name);
        return `Created ${folder}. Send /${folderCommand(folder)} <text> to file into it.`;
      } catch (err: unknown) {
        // A name already in use or one that cannot be a folder is answered, not thrown: the person
        // is holding a phone and can act on the sentence.
        if (err instanceof NoteFileError) return err.message;
        throw err;
      }
    }
    case "plan":
      return buildPlan(vaultDir, parsed.when, options.plan);
    case "find": {
      const query = parsed.query.trim();
      if (!query) return "Usage: /find <query>";
      return formatFind(query, await searchNotes(vaultDir, query));
    }
    case "help":
      return helpText(folders);
    case "unknown":
      return `Unknown command /${parsed.command}\n\n${helpText(folders)}`;
  }
}
