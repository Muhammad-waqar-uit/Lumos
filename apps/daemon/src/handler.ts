import { parseMessage } from "./commands.js";
import { saveNote } from "./vault.js";

const HELP = [
  "Commands:",
  "/idea <text>",
  "/interview <link or text>",
  "/goal <text>",
  "/read <link>",
  "/plan today | tomorrow",
  "/find <query>",
  "Anything without a command goes to Inbox.",
].join("\n");

export async function handleMessage(text: string): Promise<string> {
  const parsed = parseMessage(text);
  switch (parsed.kind) {
    case "note": {
      if (!parsed.text && !parsed.url) return "Add some text or a link after the command.";
      const { title } = await saveNote(parsed);
      return `Filed in ${parsed.folder}: ${title}`;
    }
    case "plan":
      return `Lumos Maxima (${parsed.when}) isn't built yet.`;
    case "find":
      return "Search isn't built yet.";
    case "help":
      return HELP;
    case "unknown":
      return `Unknown command /${parsed.command}\n\n${HELP}`;
  }
}
