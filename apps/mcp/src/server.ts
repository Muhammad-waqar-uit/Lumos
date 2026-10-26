/**
 * The MCP server: the tools this vault offers a model, and their descriptions.
 *
 * The descriptions are the whole interface. A client decides what to call from them alone, so each
 * one says what the tool does, what it costs and what it will refuse - and the server's
 * `instructions` say the thing no single tool can: that these are a person's own notes, and a
 * delete is a move to the trash rather than the end of one.
 *
 * A refusal the vault wrote (a bad key, a folder that is not there, a name already taken) is
 * answered as a tool error with its sentence, because that is a result the model can read and act
 * on. Anything else is thrown: an unexpected failure is not disguised as advice.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { NoteFileError } from "@lumos/vault-utils";
import { z } from "zod";
import {
  createFolder,
  createNote,
  deleteNote,
  listFolders,
  listNotes,
  listTrash,
  moveNote,
  readNote,
  renameNote,
  restoreNote,
  searchNotes,
  updateNote,
} from "./tools.js";
import { entryLines, folderLines, noteText, trashLines } from "./render.js";
import { resolveVault } from "./vault.js";

/** What the client shows a model before it calls anything. */
const INSTRUCTIONS = [
  "This server reads and writes one Lumos vault: a directory of Markdown notes with YAML",
  "frontmatter, organised into folders.",
  "",
  "Notes are addressed by key - `Folder/filename.md` - which every tool answers and every tool",
  "accepts, so a key from one call can be passed to the next unchanged.",
  "",
  "The vault is the person's own writing. Prefer `search_notes` or `list_notes` before reading,",
  "read before editing, and send `update_note` the whole body: it replaces the note's text rather",
  "than patching it, so a partial body would shorten the note. A delete goes to the trash and",
  "answers the id that restores it; nothing here deletes a note outright.",
  "",
  "A new note needs a folder that already exists - `create_folder` makes one.",
].join("\n");

/** Text a tool answers with, or the refusal it answered instead. */
function text(value: string): CallToolResult {
  return { content: [{ type: "text", text: value }] };
}

async function answer(work: () => Promise<string>): Promise<CallToolResult> {
  try {
    return text(await work());
  } catch (err: unknown) {
    if (err instanceof NoteFileError) {
      return { content: [{ type: "text", text: err.message }], isError: true };
    }
    throw err;
  }
}

/** The one argument every note tool takes. */
const KEY = z
  .string()
  .describe('The note key, as a listing answered it: "Inbox/2026-10-20-trip.md"');

const FOLDER = z
  .string()
  .describe("An existing folder name. The vault answers the list, so ask before inventing one.");

const TAGS = z.array(z.string()).describe("The whole tag list, replacing what the note had.");

const STATUS = z.string().describe('The note\'s status, such as "new", "reading" or "done".');

/**
 * Build the server over one vault.
 *
 * The vault is an argument rather than read here, so a test can point it at a temporary directory
 * and drive the same object the stdio entry point serves.
 */
export function createServer({ vault = resolveVault() }: { vault?: string } = {}): McpServer {
  const server = new McpServer({ name: "lumos", version: "0.1.0" }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "list_folders",
    {
      title: "List folders",
      description:
        "Every folder in the vault with how many notes it holds. Cheap - one directory read - and " +
        "the right first call when you do not know where a note would belong.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => answer(async () => folderLines(await listFolders(vault))),
  );

  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description:
        "The notes in the vault, newest first, as keys with titles, tags and a short excerpt - " +
        "enough to choose a note without reading it. Pass a folder to narrow it.",
      inputSchema: {
        folder: FOLDER.optional().describe("Only the notes in this folder."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ folder }) => answer(async () => entryLines(await listNotes(vault, folder))),
  );

  server.registerTool(
    "search_notes",
    {
      title: "Search notes",
      description:
        "Case-insensitive search across every note's title, tags and body. Answers the same keys " +
        "`list_notes` does. Read a note with `read_note` to see why it matched.",
      inputSchema: {
        query: z.string().describe("What to look for. A phrase, a word, or part of one."),
      },
      annotations: { readOnlyHint: true },
    },
    ({ query }) => answer(async () => entryLines(await searchNotes(vault, query))),
  );

  server.registerTool(
    "read_note",
    {
      title: "Read a note",
      description:
        "One note in full: its key, title, tags, status, creation date and Markdown body. The " +
        "frontmatter block is not repeated inside the body, so what this shows is what " +
        "`update_note` replaces.",
      inputSchema: { key: KEY },
      annotations: { readOnlyHint: true },
    },
    ({ key }) =>
      answer(async () => {
        const { key: resolved, note } = await readNote(vault, key);
        return noteText(resolved, note);
      }),
  );

  server.registerTool(
    "create_note",
    {
      title: "Create a note",
      description:
        "Write a new note into an existing folder, filed exactly as a captured WhatsApp message " +
        "would be: a dated filename, a heading from the first line of the text, and any #hashtags " +
        "in the text as tags. It never overwrites: a name already taken gets a suffix.",
      inputSchema: {
        folder: FOLDER,
        text: z.string().describe("The note's text. Its first line becomes the title."),
        tags: TAGS.optional(),
        status: STATUS.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ folder, text, tags, status }) =>
      answer(async () => {
        const { key, note } = await createNote(vault, {
          folder,
          text,
          ...(tags !== undefined ? { tags } : {}),
          ...(status !== undefined ? { status } : {}),
        });
        return `created ${key}\n\n${noteText(key, note)}`;
      }),
  );

  server.registerTool(
    "update_note",
    {
      title: "Update a note",
      description:
        "Change a note's body, tags or status. `content` replaces the whole body - send the text " +
        "you want the note to have, not a fragment of it - and the frontmatter block is left as " +
        "the file has it unless you also send `tags` or `status`.",
      inputSchema: {
        key: KEY,
        content: z.string().optional().describe("The whole new body."),
        tags: TAGS.optional(),
        status: STATUS.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ key, content, tags, status }) =>
      answer(async () => {
        const updated = await updateNote(vault, {
          key,
          ...(content !== undefined ? { content } : {}),
          ...(tags !== undefined ? { tags } : {}),
          ...(status !== undefined ? { status } : {}),
        });
        return `updated ${updated.key}\n\n${noteText(updated.key, updated.note)}`;
      }),
  );

  server.registerTool(
    "rename_note",
    {
      title: "Rename a note",
      description:
        "Give a note a new title. The file is renamed to match, the heading in its body follows, " +
        "and every other note that linked to it is edited so the backlinks still resolve - so this " +
        "can change files beyond the one named. Answers those files too.",
      inputSchema: {
        key: KEY,
        title: z.string().describe("The new title, as a person would write it."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ key, title }) =>
      answer(async () => {
        const renamed = await renameNote(vault, { key, title });
        const links =
          renamed.updated.length > 0
            ? `\n${renamed.updated.length} note(s) linking to it were updated: ${renamed.updated.join(", ")}`
            : "";
        return `renamed to "${renamed.title}", now at ${renamed.key}${links}`;
      }),
  );

  server.registerTool(
    "move_note",
    {
      title: "Move a note",
      description: "Move a note into another existing folder, keeping its filename and its text.",
      inputSchema: { key: KEY, folder: FOLDER },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ key, folder }) =>
      answer(async () => {
        const moved = await moveNote(vault, { key, folder });
        return `moved to ${moved.key}`;
      }),
  );

  server.registerTool(
    "delete_note",
    {
      title: "Delete a note",
      description:
        "Move a note to the vault's trash. The entry id it answers with is what `restore_note` " +
        "takes, and the file stays on disk until the trash is emptied in the app.",
      inputSchema: { key: KEY },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ key }) =>
      answer(async () => {
        const entry = await deleteNote(vault, key);
        return `moved ${entry.folder}/${entry.name} to the trash as ${entry.id} - restore_note can put it back`;
      }),
  );

  server.registerTool(
    "list_trash",
    {
      title: "List the trash",
      description:
        "The deleted notes still waiting in the trash, newest first, with their entry ids.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => answer(async () => trashLines(await listTrash(vault))),
  );

  server.registerTool(
    "restore_note",
    {
      title: "Restore a deleted note",
      description:
        "Put a note from the trash back where it came from. The entry decides the destination, so " +
        "this cannot be aimed anywhere else; a note that has since returned under the same name is " +
        "refused rather than replaced.",
      inputSchema: {
        id: z.string().describe("The trash entry id `delete_note` or `list_trash` answered."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ id }) =>
      answer(async () => {
        const restored = await restoreNote(vault, id);
        return `restored "${restored.title}" to ${restored.key}`;
      }),
  );

  server.registerTool(
    "create_folder",
    {
      title: "Create a folder",
      description:
        "Add a folder to the vault. A name already in use is refused rather than accepted " +
        "quietly, because the second one would create nothing.",
      inputSchema: {
        name: z.string().describe("The folder name, without a path separator."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ name }) =>
      answer(async () => {
        const created = await createFolder(vault, name);
        return `created the folder ${created.folder}`;
      }),
  );

  return server;
}
