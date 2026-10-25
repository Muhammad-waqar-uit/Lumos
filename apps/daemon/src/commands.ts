import {
  DEFAULT_FOLDERS,
  folderCommand,
  type Folder,
  type NoteInput,
  type Parsed,
} from "@lumos/shared";

export type { Folder, NoteInput, Parsed };

/**
 * The shorthands the commands have always had: a folder named `Ideas` answers to `/ideas` by its
 * own name, and to `/idea` because that is what was documented before folders were free-form.
 */
const ALIASES: Record<string, Folder> = {
  idea: "Ideas",
  interview: "Interviews",
  goal: "Goals",
  read: "Reading",
};

const URL_RE = /https?:\/\/\S+/i;

function toNote(folder: Folder, body: string): Parsed {
  const url = body.match(URL_RE)?.[0];
  const text = url ? body.replace(url, "").trim() : body;
  return { kind: "note", folder, text, url };
}

/**
 * Every command word that files a note, and the folder it files into.
 *
 * Built from the folders the vault actually has, so `/movies` starts working the moment a `Movies`
 * folder exists - there is no second list of commands to keep in step. A folder's own name wins over
 * a shorthand, because the folder is the thing the person made.
 */
export function folderCommands(folders: readonly string[]): Record<string, Folder> {
  const map: Record<string, Folder> = {};
  for (const folder of folders) {
    const command = folderCommand(folder);
    if (command) map[command] = folder;
  }
  for (const [command, folder] of Object.entries(ALIASES)) {
    if (!(command in map)) map[command] = folder;
  }
  return map;
}

/**
 * Read one message as an intent.
 *
 * A bare `/` is the menu: a phone keyboard has no slash-command autocomplete for a chat like this,
 * so the list has to be something the person can ask for with one keystroke.
 */
export function parseMessage(raw: string, folders: readonly string[] = DEFAULT_FOLDERS): Parsed {
  const msg = raw.trim();
  if (!msg.startsWith("/")) return toNote("Inbox", msg);

  const [cmd, ...rest] = msg.slice(1).split(/\s+/);
  const name = (cmd ?? "").toLowerCase();
  const body = rest.join(" ").trim();

  if (!name || name === "help") return { kind: "help" };
  if (name === "newfolder" || name === "folder") return { kind: "newFolder", name: body };
  if (name === "plan") {
    return { kind: "plan", when: body.toLowerCase() === "tomorrow" ? "tomorrow" : "today" };
  }
  if (name === "find") return { kind: "find", query: body };

  const target = folderCommands(folders)[name];
  if (target) return toNote(target, body);
  return { kind: "unknown", command: name };
}
