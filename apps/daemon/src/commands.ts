import type { Folder, NoteInput, Parsed } from "@lumos/shared";

export type { Folder, NoteInput, Parsed };

const FOLDER_COMMANDS: Record<string, Folder> = {
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

export function parseMessage(raw: string): Parsed {
  const msg = raw.trim();
  if (!msg.startsWith("/")) return toNote("Inbox", msg);

  const [cmd, ...rest] = msg.slice(1).split(/\s+/);
  const name = cmd.toLowerCase();
  const body = rest.join(" ").trim();

  if (name in FOLDER_COMMANDS) return toNote(FOLDER_COMMANDS[name], body);
  if (name === "plan") {
    return { kind: "plan", when: body.toLowerCase() === "tomorrow" ? "tomorrow" : "today" };
  }
  if (name === "find") return { kind: "find", query: body };
  if (name === "help") return { kind: "help" };
  return { kind: "unknown", command: name };
}
