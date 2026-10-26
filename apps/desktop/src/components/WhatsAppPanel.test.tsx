// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WhatsAppStatus } from "@lumos/shared";
import { WhatsAppPanel } from "./WhatsAppPanel";

afterEach(cleanup);

function status(overrides: Partial<WhatsAppStatus> = {}): WhatsAppStatus {
  return {
    enabled: true,
    state: "connected",
    since: "2026-10-25T10:00:00.000Z",
    error: null,
    qr: null,
    ...overrides,
  };
}

function renderPanel(overrides: Partial<Parameters<typeof WhatsAppPanel>[0]> = {}) {
  const props = {
    status: status(),
    read: "ok" as const,
    onConnect: vi.fn(async () => {}),
    onDisconnect: vi.fn(async () => {}),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<WhatsAppPanel {...props} />);
  return props;
}

describe("WhatsAppPanel", () => {
  it("says the link is filing notes, and offers to stop it", async () => {
    const { onDisconnect } = renderPanel();

    expect(screen.getByText("WhatsApp linked")).toBeDefined();
    expect(screen.getByText(/filed into the vault/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledTimes(1));
  });

  it("shows the pairing code while a phone has to scan one", () => {
    renderPanel({ status: status({ state: "waiting", qr: "█▀█\n▀▀▀", since: null }) });

    // Half blocks in a <pre>: the same drawing the daemon's page makes, so no QR library here.
    expect(document.querySelector("pre")?.textContent).toBe("█▀█\n▀▀▀");
    expect(screen.getByText(/Link a device/)).toBeDefined();
  });

  it("offers Connect on a link that is down, and keeps the phone's pairing in the sentence", () => {
    renderPanel({ status: status({ state: "disconnected", error: null }) });

    expect(screen.getByRole("button", { name: "Connect" })).toBeDefined();
    expect(screen.getByText(/still linked/)).toBeDefined();
  });

  it("says capture is switched off, with no button that would do nothing", () => {
    renderPanel({ status: status({ state: "off", enabled: false }) });

    expect(screen.getByText(/LUMOS_DISABLE_WHATSAPP/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
  });

  it("says the daemon did not answer rather than showing a state that may be stale", () => {
    renderPanel({ status: null, read: "error" });

    expect(screen.getByText(/did not answer/)).toBeDefined();
  });

  it("keeps a refused action on screen in the daemon's words", async () => {
    const onConnect = vi.fn(async () => {
      throw new Error("WhatsApp capture is switched off for this daemon.");
    });
    renderPanel({ status: status({ state: "disconnected" }), onConnect });

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(
      await screen.findByText("WhatsApp capture is switched off for this daemon."),
    ).toBeDefined();
  });

  it("closes on Escape and on a click outside the card", () => {
    const { onClose } = renderPanel();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = document.querySelector('[role="dialog"]')?.parentElement;
    if (backdrop) fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
