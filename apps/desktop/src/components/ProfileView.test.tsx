// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { VaultEntry } from "@lumos/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProfileStore } from "../lib/profile";
import { ProfileView } from "./ProfileView";

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  useProfileStore.setState({ name: "", bio: "", username: "", readme: "", pins: [] });
});

/** A note `days` before today, at local noon, for the cases the clock is part of. */
function daysAgo(days: number, title = "A note"): VaultEntry {
  const date = new Date();
  return entryAt(new Date(date.getFullYear(), date.getMonth(), date.getDate() - days, 12), title);
}

/** A note created at local noon, so its square lands on the day the test names. */
function entry(day: string, title = "A note", tags: string[] = []): VaultEntry {
  const [year, month, date] = day.split("-").map(Number);
  return entryAt(new Date(year, month - 1, date, 12), title, tags);
}

function entryAt(at: Date, title = "A note", tags: string[] = []): VaultEntry {
  return {
    title,
    folder: "Inbox",
    file: `Inbox/${title}.md`,
    name: `${title}.md`,
    created: at.toISOString(),
    tags,
    excerpt: "The start of the note, for the card.",
  };
}

function renderView(notes: VaultEntry[], onOpen = vi.fn()): void {
  render(<ProfileView notes={notes} connection="daemon" loading={false} onOpen={onOpen} />);
}

const NOTES = [entry("2026-10-26", "Morning walk"), entry("2026-10-20", "Desk lamp")];

describe("ProfileView", () => {
  it("falls back to a name and a line when the profile is empty", () => {
    renderView(NOTES);
    expect(screen.getByRole("heading", { name: "Your vault" })).toBeTruthy();
    expect(
      screen.getByText("A second brain on your own disk. Nothing leaves the machine."),
    ).toBeTruthy();
  });

  it("saves a display name, local username and bio", () => {
    renderView(NOTES);

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Waqar" } });
    fireEvent.change(screen.getByLabelText("One line about it"), {
      target: { value: "notes on rust" },
    });
    fireEvent.change(screen.getByLabelText("Username (local display name)"), {
      target: { value: "Waqar Khan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("heading", { name: "Waqar" })).toBeTruthy();
    expect(screen.getByText("notes on rust")).toBeTruthy();
    expect(screen.getByText("@waqar-khan")).toBeTruthy();
    expect(useProfileStore.getState().name).toBe("Waqar");
    expect(useProfileStore.getState().username).toBe("waqar-khan");
  });

  it("edits and previews a GitHub-style Markdown profile README", () => {
    renderView(NOTES);
    fireEvent.click(screen.getByRole("button", { name: "Write a README" }));
    fireEvent.change(screen.getByLabelText("Profile README Markdown"), {
      target: { value: "## About\n\nLearning Rust." },
    });
    expect(screen.getByRole("heading", { level: 2, name: "About" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save README" }));
    expect(screen.getByText("Learning Rust.")).toBeTruthy();
    expect(useProfileStore.getState().readme).toBe("## About\n\nLearning Rust.");
  });

  it("pins a note from the picker and unpins it from its card", () => {
    renderView(NOTES);

    fireEvent.click(screen.getByRole("button", { name: "Customize your pins" }));
    fireEvent.click(screen.getByRole("button", { name: /Morning walk/ }));

    // The card carries the note's folder and date, and the picker row reads as pressed.
    expect(screen.getByText("Inbox · Oct 26, 2026")).toBeTruthy();
    expect(screen.getByText("The start of the note, for the card.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Morning walk/, pressed: true })).toBeTruthy();
    expect(useProfileStore.getState().pins).toEqual(["Inbox/Morning walk.md"]);

    fireEvent.click(screen.getByRole("button", { name: "Unpin Morning walk" }));
    expect(screen.queryByRole("button", { name: "Unpin Morning walk" })).toBeNull();
    expect(screen.queryByText("Inbox · Oct 26, 2026")).toBeNull();
    expect(useProfileStore.getState().pins).toEqual([]);
  });

  it("opens a pinned note through the shell's handler", () => {
    useProfileStore.setState({
      name: "",
      bio: "",
      username: "",
      readme: "",
      pins: ["Inbox/Morning walk.md"],
    });
    const onOpen = vi.fn();
    renderView(NOTES, onOpen);

    fireEvent.click(screen.getByRole("button", { name: "Morning walk" }));
    expect(onOpen).toHaveBeenCalledWith("Inbox/Morning walk.md");
  });

  it("drops a pin whose note is gone instead of drawing a card that cannot open", () => {
    useProfileStore.setState({
      name: "",
      bio: "",
      username: "",
      readme: "",
      pins: ["Inbox/Deleted.md"],
    });
    renderView(NOTES);

    expect(screen.queryByRole("button", { name: "Unpin Deleted" })).toBeNull();
    expect(screen.getByText(/Nothing pinned/)).toBeTruthy();
  });

  it("draws a year of squares and the streaks counted from them", () => {
    // Relative dates: the pane counts streaks against the real clock, so fixed dates would start
    // failing the day after they were written.
    renderView([daysAgo(1), daysAgo(0), daysAgo(0)]);

    const grid = screen.getByRole("img", { name: /notes across .* days in \d{4}/ });
    // Every column is seven cells tall, and the year is padded out to whole weeks.
    const cells = grid.querySelectorAll("div > span");
    expect(cells.length).toBeGreaterThan(365);
    expect(cells.length % 7).toBe(0);
    // Two notes is the second step, one note the first, and every other day is empty - the bands
    // are absolute, so a quiet vault does not paint every square at full brightness.
    expect(grid.querySelectorAll(".heat-2").length).toBe(1);
    expect(grid.querySelectorAll(".heat-1").length).toBe(1);
    expect(grid.querySelectorAll(".heat-4").length).toBe(0);

    // Yesterday and today are in a row, so both streaks read two days.
    expect(screen.getByText("Longest streak")).toBeTruthy();
    expect(screen.getAllByText("2d")).toHaveLength(2);
  });

  it("says so when the vault is empty rather than drawing a blank grid", () => {
    renderView([]);
    expect(screen.getByText(/The vault is empty/)).toBeTruthy();
  });

  it("never offers more than the pin limit", () => {
    useProfileStore.setState({
      name: "",
      bio: "",
      username: "",
      readme: "",
      pins: Array.from({ length: 6 }, (_, index) => `Ideas/n${index}.md`),
    });
    renderView([entry("2026-10-26", "Morning walk")]);

    fireEvent.click(screen.getByRole("button", { name: "Customize your pins" }));
    const pin = screen.getByRole("button", { name: /Morning walk/ });
    expect(pin).toHaveProperty("disabled", true);
    expect(pin.getAttribute("title")).toBe("Up to 6 pins");
  });
});
