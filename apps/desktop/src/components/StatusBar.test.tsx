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
});
