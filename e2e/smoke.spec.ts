import { type Page, expect, test } from "@playwright/test";

/**
 * The smoke suite: the built bundle, in a real browser, against a real daemon on the fixture vault
 * in `fixtures/`. It covers the path jsdom cannot - that the shipped build reaches the daemon, and
 * that the Markdown, highlighting and keyboard wiring survive bundling.
 */

/**
 * Fail the test on any uncaught error in the page. A smoke run that walked past a crash is worse
 * than no run, because it reads as proof.
 */
function watchForErrors(page: Page): () => void {
  const errors: string[] = [];
  page.on("pageerror", (err: Error) => errors.push(err.message));
  return () => expect(errors).toEqual([]);
}

test("loads the fixture vault through the daemon and opens the newest note", async ({ page }) => {
  const noErrors = watchForErrors(page);

  await page.goto("/");
  // Not "Daemon offline" - the built app found the daemon on its own URL. Scoped to the footer:
  // the same words sit inside a fixture note's excerpt, so an unscoped query is ambiguous.
  const status = page.getByRole("contentinfo");
  await expect(status.getByText("Connected to daemon")).toBeVisible();

  const folders = page.getByRole("navigation", { name: "Folders" });
  const inbox = folders.getByRole("button", { name: /Inbox/ });
  const reading = folders.getByRole("button", { name: /Reading/ });
  await expect(inbox).toContainText("2");
  await expect(reading).toContainText("1");

  // Three rows, newest first, and the newest is open in the viewer without being asked.
  await expect(page.getByRole("button", { name: /Morning walk/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Browser smoke tests/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Morning walk" })).toBeVisible();
  await expect(status.getByText("3 notes")).toBeVisible();

  noErrors();
});

test("opens another note and renders its Markdown, code fence included", async ({ page }) => {
  const noErrors = watchForErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: /Browser smoke tests/ }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Browser smoke tests" })).toBeVisible();
  // The fence survived the build as a real highlighted block, not preformatted text.
  await expect(page.locator("pre code.language-js")).toContainText("expect(statusBar)");

  noErrors();
});

test("lists a note's backlinks and follows one", async ({ page }) => {
  const noErrors = watchForErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: /Browser smoke tests/ }).click();
  // Anchored at the start: the "Morning walk" row's excerpt quotes "[[Plan the week]]", so an
  // unscoped substring query matches both rows, but only this one *begins* with the title.
  await page.getByRole("button", { name: /^Plan the week/ }).click();

  const linked = page.getByRole("region", { name: "Linked from" });
  await expect(linked).toContainText("Linked from 1");
  await linked.getByRole("button", { name: "Morning walk Inbox" }).click();

  await expect(page.getByRole("heading", { level: 2, name: "Morning walk" })).toBeVisible();

  noErrors();
});

test("narrows the list with a tag chip, and puts it back", async ({ page }) => {
  const noErrors = watchForErrors(page);

  await page.goto("/");
  // #testing sits on one note only; #planning sits on two, which would prove less.
  const chips = page.getByRole("group", { name: "Filter by tag" });
  await chips.getByRole("button", { name: /#testing/ }).click();

  await expect(page.getByRole("button", { name: /Browser smoke tests/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Morning walk/ })).toHaveCount(0);
  await expect(page.getByText("1 note", { exact: true })).toBeVisible();

  await chips.getByRole("button", { name: /#testing/ }).click();
  await expect(page.getByRole("button", { name: /Morning walk/ })).toBeVisible();

  noErrors();
});

test("finds a note from the palette and opens it with Enter", async ({ page }) => {
  const noErrors = watchForErrors(page);

  await page.goto("/");
  // Start somewhere else, so opening the searched note is a change and not the default.
  await page.getByRole("button", { name: /Browser smoke tests/ }).click();

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Search the vault" });
  await palette.getByRole("searchbox").fill("river path");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { level: 2, name: "Morning walk" })).toBeVisible();
  await expect(palette).toHaveCount(0);

  noErrors();
});
