import { describe, expect, it } from "vitest";
import { parseMessage } from "./commands";

describe("parseMessage - plain text", () => {
  it("files anything without a command in the Inbox", () => {
    expect(parseMessage("random thought")).toEqual({
      kind: "note",
      folder: "Inbox",
      text: "random thought",
    });
  });

  it("trims the surrounding whitespace", () => {
    expect(parseMessage("  spaced out  ")).toEqual({
      kind: "note",
      folder: "Inbox",
      text: "spaced out",
    });
  });

  it("keeps line breaks inside a multi-line message", () => {
    const parsed = parseMessage("first line\nsecond line");
    expect(parsed).toMatchObject({ kind: "note", folder: "Inbox" });
    expect(parsed.kind === "note" && parsed.text).toBe("first line\nsecond line");
  });

  it("returns an empty note for a blank message", () => {
    expect(parseMessage("   ")).toEqual({ kind: "note", folder: "Inbox", text: "" });
  });

  it("pulls a link out of plain text", () => {
    const parsed = parseMessage("check this https://example.com/post out");
    expect(parsed).toMatchObject({
      kind: "note",
      folder: "Inbox",
      url: "https://example.com/post",
    });
    expect(parsed.kind === "note" && parsed.text).not.toContain("https://");
  });
});

describe("parseMessage - folder commands", () => {
  it.each([
    ["/idea build a habit tracker", "Ideas"],
    ["/interview tell me about the team", "Interviews"],
    ["/goal ship one CLI", "Goals"],
    ["/read https://example.com/post", "Reading"],
  ])("routes %s to %s", (raw, folder) => {
    expect(parseMessage(raw)).toMatchObject({ kind: "note", folder });
  });

  it("matches the command case-insensitively", () => {
    expect(parseMessage("/IDEA shout")).toEqual({ kind: "note", folder: "Ideas", text: "shout" });
  });

  it("collapses the whitespace between command and body", () => {
    expect(parseMessage("/idea    two   spaces")).toEqual({
      kind: "note",
      folder: "Ideas",
      text: "two spaces",
    });
  });

  it("keeps a bare command as an empty note", () => {
    expect(parseMessage("/idea")).toEqual({ kind: "note", folder: "Ideas", text: "" });
  });

  it("stores a link-only /read without any text", () => {
    expect(parseMessage("/read https://example.com/post")).toEqual({
      kind: "note",
      folder: "Reading",
      text: "",
      url: "https://example.com/post",
    });
  });

  it("strips the link out of the text when both are given", () => {
    expect(parseMessage("/read https://example.com/post read this later")).toEqual({
      kind: "note",
      folder: "Reading",
      text: "read this later",
      url: "https://example.com/post",
    });
  });

  it("leaves the text intact when only text is given", () => {
    expect(parseMessage("/interview phone screen notes")).toEqual({
      kind: "note",
      folder: "Interviews",
      text: "phone screen notes",
    });
  });
});

describe("parseMessage - other commands", () => {
  it("defaults /plan to today", () => {
    expect(parseMessage("/plan")).toEqual({ kind: "plan", when: "today" });
  });

  it("understands /plan today and /plan tomorrow", () => {
    expect(parseMessage("/plan today")).toEqual({ kind: "plan", when: "today" });
    expect(parseMessage("/plan tomorrow")).toEqual({ kind: "plan", when: "tomorrow" });
    expect(parseMessage("/plan TOMORROW")).toEqual({ kind: "plan", when: "tomorrow" });
  });

  it("falls back to today for an unrecognised /plan argument", () => {
    expect(parseMessage("/plan next week")).toEqual({ kind: "plan", when: "today" });
  });

  it("keeps the whole query for /find", () => {
    expect(parseMessage("/find rust async")).toEqual({ kind: "find", query: "rust async" });
    expect(parseMessage("/find")).toEqual({ kind: "find", query: "" });
  });

  it("treats /help as help whatever follows it", () => {
    expect(parseMessage("/help")).toEqual({ kind: "help" });
    expect(parseMessage("/help me")).toEqual({ kind: "help" });
  });

  it("treats a bare slash as the menu", () => {
    // A phone keyboard has no command autocomplete for a chat, so one keystroke asks for the list.
    expect(parseMessage("/")).toEqual({ kind: "help" });
    expect(parseMessage("  /  ")).toEqual({ kind: "help" });
  });

  it.each(["/bogus", "/bogus ignored args"])("reports %s as unknown", (raw) => {
    expect(parseMessage(raw).kind).toBe("unknown");
  });

  it("names the unknown command so the reply can echo it", () => {
    expect(parseMessage("/nope whatever")).toEqual({ kind: "unknown", command: "nope" });
  });
});

describe("parseMessage - folders made by the person", () => {
  const folders = ["Inbox", "Ideas", "Interviews", "Goals", "Reading", "Movies"];

  it("files into a folder by its name", () => {
    expect(parseMessage("/movies https://example.com/trailer", folders)).toEqual({
      kind: "note",
      folder: "Movies",
      text: "",
      url: "https://example.com/trailer",
    });
  });

  it("turns the spaces of a folder name into dashes for the command", () => {
    expect(parseMessage("/to-read a link", [...folders, "To Read"])).toEqual({
      kind: "note",
      folder: "To Read",
      text: "a link",
    });
  });

  it("only knows the folders it is given", () => {
    expect(parseMessage("/movies x", ["Inbox"])).toEqual({ kind: "unknown", command: "movies" });
  });

  it("keeps the shorthand for a folder whose own name it is not", () => {
    // `/idea` has always been the command, and the folder it names is `Ideas`.
    expect(parseMessage("/idea shout", folders)).toEqual({
      kind: "note",
      folder: "Ideas",
      text: "shout",
    });
  });

  it("matches a folder's own name before a shorthand with the same word", () => {
    expect(parseMessage("/read x", [...folders, "Read"])).toEqual({
      kind: "note",
      folder: "Read",
      text: "x",
    });
  });

  it("reads /newfolder with the name that follows", () => {
    expect(parseMessage("/newfolder Movie Night")).toEqual({
      kind: "newFolder",
      name: "Movie Night",
    });
    expect(parseMessage("/folder Recipes")).toEqual({ kind: "newFolder", name: "Recipes" });
  });

  it("splits /renamefolder on the one separator a folder name cannot carry", () => {
    // `|` is refused by folderNameProblem, so there is no folder whose name could be read as part
    // of the other side of this command.
    expect(parseMessage("/renamefolder Movies|Film")).toEqual({
      kind: "renameFolder",
      from: "Movies",
      to: "Film",
    });
  });

  it("keeps spaces and further separators in the new name", () => {
    expect(parseMessage("/renamefolder  To Read  |  Reading List  ")).toEqual({
      kind: "renameFolder",
      from: "To Read",
      to: "Reading List",
    });
    expect(parseMessage("/renamefolder A|B|C")).toEqual({
      kind: "renameFolder",
      from: "A",
      to: "B|C",
    });
  });

  it("leaves a missing half empty rather than guessing at it", () => {
    expect(parseMessage("/renamefolder Movies|")).toEqual({
      kind: "renameFolder",
      from: "Movies",
      to: "",
    });
    expect(parseMessage("/renamefolder |Film")).toEqual({
      kind: "renameFolder",
      from: "",
      to: "Film",
    });
    expect(parseMessage("/renamefolder")).toEqual({ kind: "renameFolder", from: "", to: "" });
  });

  it("reads /delfolder with the name that follows, and accepts its longer spelling", () => {
    expect(parseMessage("/delfolder Movie Night")).toEqual({
      kind: "removeFolder",
      name: "Movie Night",
    });
    expect(parseMessage("/removefolder Movies")).toEqual({
      kind: "removeFolder",
      name: "Movies",
    });
  });

  it("matches the folder commands case-insensitively", () => {
    expect(parseMessage("/RENAMEFOLDER A|B")).toMatchObject({ kind: "renameFolder" });
    expect(parseMessage("/DELfolder Movies")).toEqual({ kind: "removeFolder", name: "Movies" });
  });
});
