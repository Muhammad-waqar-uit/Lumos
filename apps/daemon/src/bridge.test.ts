import { beforeEach, describe, expect, it } from "vitest";
import {
  DISABLED_BRIDGE,
  bridgeAnswered,
  bridgeEnabled,
  bridgeReport,
  bridgeState,
  resetBridge,
} from "./bridge";

describe("the WhatsApp link's state", () => {
  beforeEach(resetBridge);

  it("starts off, with nothing connected, nothing to scan and nothing answered", () => {
    expect(bridgeReport()).toEqual({
      enabled: false,
      state: "off",
      since: null,
      error: null,
      lastAt: null,
    });
  });

  it("stamps when a state began, and holds that moment while the state does not change", () => {
    bridgeEnabled(true);
    bridgeState("starting", null, new Date("2026-10-25T10:00:00.000Z"));
    expect(bridgeReport().since).toBe("2026-10-25T10:00:00.000Z");

    // A code rotating re-states "waiting" every few seconds; the clock must not move with it, or
    // "waiting since" would mean "waiting since the last code".
    bridgeState("waiting", null, new Date("2026-10-25T10:00:05.000Z"));
    bridgeState("waiting", null, new Date("2026-10-25T10:00:10.000Z"));
    expect(bridgeReport().since).toBe("2026-10-25T10:00:05.000Z");

    bridgeState("connected", null, new Date("2026-10-25T10:00:30.000Z"));
    expect(bridgeReport()).toEqual({
      enabled: true,
      state: "connected",
      since: "2026-10-25T10:00:30.000Z",
      error: null,
      lastAt: null,
    });
  });

  it("records an answered message without pretending the state changed", () => {
    bridgeState("connected", null, new Date("2026-10-25T10:00:00.000Z"));
    bridgeAnswered(new Date("2026-10-25T10:04:00.000Z"));

    // "connected" says a socket is open; lastAt is the only field that says the loop ran, so the
    // two must not move together or neither would mean anything.
    expect(bridgeReport().state).toBe("connected");
    expect(bridgeReport().since).toBe("2026-10-25T10:00:00.000Z");
    expect(bridgeReport().lastAt).toBe("2026-10-25T10:04:00.000Z");
  });

  it("carries the reason with the state, and drops it when the next state has none", () => {
    bridgeState("error", "The link could not start.");
    expect(bridgeReport().error).toBe("The link could not start.");

    bridgeState("connected");
    expect(bridgeReport().error).toBeNull();
  });
});

describe("a daemon with capture switched off", () => {
  it("reports off and has no connection for a request to start", async () => {
    expect(DISABLED_BRIDGE.status()).toEqual({
      enabled: false,
      state: "off",
      since: null,
      error: null,
      lastAt: null,
    });
    // The route checks `enabled` first and answers with the setting; this must not throw anyway.
    await expect(DISABLED_BRIDGE.connect()).resolves.toBeUndefined();
    await expect(DISABLED_BRIDGE.disconnect()).resolves.toBeUndefined();
  });
});
