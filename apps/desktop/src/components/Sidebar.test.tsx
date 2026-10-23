// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "@lumos/shared";
import { Sidebar } from "./Sidebar";

afterEach(cleanup);

const FOLDERS = [
  { folder: "Ideas" as Folder, count: 2 },
  { folder: "Goals" as Folder, count: 0 },
];

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  return render(
    <Sidebar
      folders={FOLDERS}
      total={2}
      active="All"
      onSelect={() => {}}
      view="notes"
      onView={() => {}}
      {...overrides}
    />,
  );
}

describe("Sidebar", () => {
  it("shows the Lumos mark beside the wordmark, hidden from assistive tech", () => {
    const { container } = renderSidebar();

    expect(screen.getByRole("heading", { name: "Lumos" })).toBeDefined();
    const mark = container.querySelector("svg");
    // The wordmark names the app, so the drawing must not be announced a second time.
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
  });

  it("lists every folder after the whole vault, each with its count", () => {
    renderSidebar();
    const folders = screen.getByRole("navigation", { name: "Folders" });
    const labels = Array.from(folders.querySelectorAll("button span:first-child")).map(
      (span) => span.textContent,
    );
    const counts = Array.from(folders.querySelectorAll("button span:last-child")).map(
      (span) => span.textContent,
    );

    expect(labels).toEqual(["All notes", "Ideas", "Goals"]);
    expect(counts).toEqual(["2", "2", "0"]);
  });

  it("marks the active folder, and only it", () => {
    renderSidebar({ active: "Ideas" });

    expect(screen.getByRole("button", { name: /Ideas/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: /Goals/ }).getAttribute("aria-current")).toBeNull();
    expect(
      screen.getByRole("button", { name: /All notes/ }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("hands back the folder that was clicked", () => {
    const onSelect = vi.fn();
    renderSidebar({ onSelect });

    fireEvent.click(screen.getByRole("button", { name: /Goals/ }));
    fireEvent.click(screen.getByRole("button", { name: /All notes/ }));

    expect(onSelect.mock.calls).toEqual([["Goals"], ["All"]]);
  });

  it("switches the view from the tabs, and says which one is showing", () => {
    const onView = vi.fn();
    renderSidebar({ view: "graph", onView });

    expect(screen.getByRole("tab", { name: "Graph" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Notes" }).getAttribute("aria-selected")).toBe("false");

    fireEvent.click(screen.getByRole("tab", { name: "Notes" }));
    expect(onView).toHaveBeenCalledWith("notes");
  });
});
