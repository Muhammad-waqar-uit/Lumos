import path from "node:path";
import { saveNote as writeNote } from "@lumos/vault-utils";
import type { NoteInput } from "@lumos/shared";

export const VAULT = process.env.VAULT_PATH ?? path.resolve(process.cwd(), "../../vault");

export async function saveNote(input: NoteInput): Promise<{ title: string; file: string }> {
  return writeNote(VAULT, input);
}
