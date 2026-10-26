// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { WhatsAppStatus } from "@lumos/shared";
import {
  WHATSAPP_DOT,
  WHATSAPP_LABEL,
  lastMessage,
  sinceWhen,
  whatsappAction,
  whatsappSentence,
} from "./whatsapp";

function status(overrides: Partial<WhatsAppStatus> = {}): WhatsAppStatus {
  return {
    enabled: true,
    state: "connected",
    since: null,
    error: null,
    lastAt: null,
    qr: null,
    ...overrides,
  };
}

describe("what the app says about the WhatsApp link", () => {
  it("has a word and a colour for every state the daemon can report", () => {
    const states = Object.keys(WHATSAPP_LABEL) as (keyof typeof WHATSAPP_LABEL)[];
    expect(states).toHaveLength(7);
    for (const state of states) {
      expect(WHATSAPP_LABEL[state].length).toBeGreaterThan(0);
      expect(WHATSAPP_DOT[state]).toMatch(/^bg-/);
    }
    // Green is only for the state that is actually filing notes.
    expect(WHATSAPP_DOT.connected).toBe("bg-emerald-400");
    expect(WHATSAPP_DOT.error).not.toBe(WHATSAPP_DOT.connected);
  });

  it("asks for a scan while waiting, and says nothing is captured when it is switched off", () => {
    expect(whatsappSentence(status({ state: "waiting" }))).toContain("Link a device");
    expect(whatsappSentence(status({ state: "off", enabled: false }))).toContain(
      "LUMOS_DISABLE_WHATSAPP",
    );
  });

  it("prefers the daemon's own reason when the link is down", () => {
    // The daemon is the only thing that knows why a socket closed; a generic sentence would be
    // a worse answer than the one it already wrote.
    expect(
      whatsappSentence(status({ state: "disconnected", error: "Connection closed (428)." })),
    ).toBe("Connection closed (428).");
    expect(whatsappSentence(status({ state: "disconnected" }))).not.toBe("");
  });

  it("offers the one button the state can use, and none when capture is off", () => {
    expect(whatsappAction(status({ state: "connected" }))).toBe("disconnect");
    expect(whatsappAction(status({ state: "waiting" }))).toBe("disconnect");
    expect(whatsappAction(status({ state: "disconnected" }))).toBe("connect");
    expect(whatsappAction(status({ state: "logged-out" }))).toBe("connect");
    // Starting is already in progress: a second press would only add a second socket.
    expect(whatsappAction(status({ state: "starting" }))).toBeNull();
    expect(whatsappAction(status({ state: "off", enabled: false }))).toBeNull();
  });
});

describe("how long the loop has been quiet", () => {
  it("says nothing before a message has been answered", () => {
    expect(lastMessage(status({ lastAt: null }))).toBe("");
  });

  it("names the last message, so a linked link is not mistaken for a working one", () => {
    const now = new Date("2026-10-25T15:00:00.000Z");
    // The clock format is the platform's (12- or 24-hour), so the expectation is built the same way
    // rather than pinning a locale the test machine may not be in.
    const when = new Date("2026-10-25T14:31:00.000Z").toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

    expect(lastMessage(status({ lastAt: "2026-10-25T14:31:00.000Z" }), now)).toBe(
      `last message ${when}`,
    );
  });
});

describe("when the state began", () => {
  it("gives a clock time for today and the date for anything older", () => {
    const now = new Date("2026-10-25T15:00:00.000Z");
    expect(sinceWhen("2026-10-25T10:00:00.000Z", now)).toMatch(/\d/);
    expect(sinceWhen("2026-10-20T10:00:00.000Z", now)).not.toBe(
      sinceWhen("2026-10-25T10:00:00.000Z", now),
    );
  });

  it("says nothing rather than an invalid date", () => {
    expect(sinceWhen(null)).toBe("");
    expect(sinceWhen("not a date")).toBe("");
  });
});
