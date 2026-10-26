/**
 * Where the vault is, and what a note key means.
 *
 * An MCP client launches this server from a directory of its own choosing, so the default vault is
 * resolved from this file's location rather than from the process's cwd, and `LUMOS_VAULT` is how a
 * person points it at a vault somewhere else.
 */
import path from "node:path";
import { NoteFileError } from "@lumos/vault-utils";

/** Environment variable that names the vault directory. */
export const VAULT_ENV = "LUMOS_VAULT";

/** The vault this repository keeps: `vault/` three levels up from `apps/mcp/src`. */
export function defaultVault(): string {
  return path.resolve(import.meta.dirname, "../../../vault");
}

/** The vault to serve: the one the environment names, or this repository's. */
export function resolveVault(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env[VAULT_ENV]?.trim();
  return configured ? path.resolve(configured) : defaultVault();
}

/** How a note is addressed, spelled once so every refusal can repeat it. */
const KEY_HINT = 'a note key looks like "Inbox/2026-10-20-plan-the-week.md"';

/** A resolved note: the two halves the vault operations take, and the file they point at. */
export interface ResolvedNote {
  folder: string;
  name: string;
  file: string;
}

/**
 * Split a note key and prove the file it names is inside the vault.
 *
 * A key is `Folder/name.md` - what every tool reports, so what a tool is given is in the same shape
 * the previous tool answered. Both halves are untrusted, so the path is resolved and checked
 * against the vault root here: a read is the one operation that would otherwise hand back any file
 * on the disk, and a write would replace one.
 */
export function resolveNote(vault: string, key: string): ResolvedNote {
  const parts = key.trim().split("/");
  if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
    throw new NoteFileError("unsafe", `"${key}" is not a note key - ${KEY_HINT}`);
  }

  const [folder, name] = parts;
  if (!name.endsWith(".md")) {
    throw new NoteFileError("unsafe", `"${key}" does not name a Markdown file - ${KEY_HINT}`);
  }

  const root = path.resolve(vault);
  const file = path.resolve(root, folder, name);
  if (!file.startsWith(`${root}${path.sep}`)) {
    throw new NoteFileError("unsafe", `"${key}" points outside the vault`);
  }
  return { folder, name, file };
}

/** The key of a file the vault answered with, so a result can be handed back as an argument. */
export function keyOf(folder: string, file: string): string {
  return `${folder}/${path.basename(file)}`;
}
