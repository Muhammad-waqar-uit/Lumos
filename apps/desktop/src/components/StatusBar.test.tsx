// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusBar } from "./StatusBar";

afterEach(cleanup);

function renderBar(overrides: Partial<Parameters<typeof StatusBar>[0]> = {}) {
  return render(<StatusBar connection="daemon" count={3} onSearch={() => {}} {...overrides} />);
}

describe("StatusBar", () => {
  it("says where the notes came from and how many are listed", () => {
    renderBar();

    expect(screen.getByText("Connected to daemon")).toBeDefined();
    expect(screen.getByText("3 notes")).toBeDefined();
  });

  it("shows the notice in place of the connection, with the action that answers it", () => {
    const onClick = vi.fn();
    renderBar({
      notice: 'Deleted "Learn Rust".',
      action: { label: "Undo", onClick },
    });

    expect(screen.queryByText("Connected to daemon")).toBeNull();
    expect(screen.getByText(/Deleted "Learn Rust"/)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("offers no action on a notice that has none, and dismisses what it does show", () => {
    const onDismissNotice = vi.fn();
    renderBar({ notice: "Saved, but the list could not be refreshed.", onDismissNotice });

    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Saved, but/ }));
    expect(onDismissNotice).toHaveBeenCalledTimes(1);
  });

  it("names the WhatsApp link's state, and opens the panel that explains it", () => {
    const onWhatsApp = vi.fn();
    renderBar({
      whatsapp: {
        enabled: true,
        state: "waiting",
        since: null,
        error: null,
        lastAt: null,
        qr: null,
      },
      onWhatsApp,
    });

    // The link is not the daemon connection: being able to read notes says nothing about whether
    // a message would be filed, so it gets its own word rather than a second green dot.
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp: Pair WhatsApp" }));
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
  });

  it("says nothing about the link when there is no daemon to ask", () => {
    renderBar({ whatsapp: null, onWhatsApp: () => {} });
    expect(screen.queryByRole("button", { name: /WhatsApp/ })).toBeNull();
  });
});
