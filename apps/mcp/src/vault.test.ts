import path from "node:path";
import { describe, expect, it } from "vitest";
import { NoteFileError } from "@lumos/vault-utils";
import { defaultVault, keyOf, resolveNote, resolveVault, VAULT_ENV } from "./vault";

describe("which vault is served", () => {
  it("is this repository's vault when nothing says otherwise", () => {
    // `apps/mcp/src` up three levels: the vault sits beside the workspaces.
    expect(defaultVault()).toBe(path.resolve(import.meta.dirname, "../../../vault"));
    expect(resolveVault({})).toBe(defaultVault());
  });

  it("is the one the environment names, resolved from wherever the client started it", () => {
    expect(resolveVault({ [VAULT_ENV]: "/tmp/somewhere/notes" })).toBe(
      path.resolve("/tmp/somewhere/notes"),
    );
  });

  it("ignores a setting that is only whitespace", () => {
    expect(resolveVault({ [VAULT_ENV]: "   " })).toBe(defaultVault());
  });
});

describe("a note key", () => {
  const vault = path.resolve("/vault");

  it("splits into the folder and the filename", () => {
    expect(resolveNote(vault, "Inbox/2026-10-20-plan.md")).toEqual({
      folder: "Inbox",
      name: "2026-10-20-plan.md",
      file: path.resolve("/vault/Inbox/2026-10-20-plan.md"),
    });
  });

  it("is what a file answers as, so a result can be passed straight back in", () => {
    expect(keyOf("Inbox", path.join("/vault/Inbox/2026-10-20-plan.md"))).toBe(
      "Inbox/2026-10-20-plan.md",
    );
  });

  it("refuses a key with more or fewer than two parts", () => {
    for (const key of ["plan.md", "Inbox/Goals/plan.md", "/plan.md", "Inbox/"]) {
      expect(() => resolveNote(vault, key)).toThrow(NoteFileError);
    }
  });

  it("refuses a key that is not Markdown", () => {
    expect(() => resolveNote(vault, "Inbox/notes.txt")).toThrow(/does not name a Markdown file/);
  });

  it("refuses a key that walks out of the vault", () => {
    for (const key of ["../secrets.md", "Inbox/../../secrets.md", "..\\secrets.md"]) {
      expect(() => resolveNote(vault, key)).toThrow(NoteFileError);
    }
  });
});
