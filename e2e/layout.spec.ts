import { type Locator, type Page, expect, test } from "@playwright/test";

/**
 * The layout at the widths a person can actually reach, measured rather than assumed.
 *
 * jsdom has no layout engine, so two things the component suites cannot see live only here: whether
 * the three-pane shell fits the window's declared minimum, and whether the insights grids answer to
 * the pane they sit in instead of to the viewport. Both were measured by hand once; these keep the
 * measurement from drifting.
 */

/** The pane the insights grids live in - the box their container queries actually query. */
function insightsPane(page: Page): Locator {
  return page.getByRole("region", { name: "Vault insights" });
}

/** How many columns a CSS grid is laying out right now, read from its computed style. */
function columnsOf(grid: Locator): Promise<number> {
  return grid.evaluate((el) => {
    const value = getComputedStyle(el).gridTemplateColumns.trim();
    return value === "" || value === "none" ? 0 : value.split(/\s+/).length;
  });
}

test("the shell fits the window's declared minimum of 860x560", async ({ page }) => {
  // The packaged window cannot be dragged below this (`src-tauri/tauri.conf.json`), so it is the
  // narrowest state a user can reach and the one worth pinning.
  await page.setViewportSize({ width: 860, height: 560 });
  await page.goto("/");

  // The newest fixture note is open, so the viewer is rendering something rather than empty.
  const heading = page.getByRole("heading", { level: 2, name: "Morning walk" });
  await expect(heading).toBeVisible();

  // Nothing is pushed sideways out of the window.
  const horizontal = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontal).toBeLessThanOrEqual(1);

  // The viewer still has a column of its own rather than the zero width a squeezed shell produces.
  const viewerBox = await page.getByRole("main").boundingBox();
  expect(viewerBox?.width ?? 0).toBeGreaterThan(280);

  // And the four pane tabs sit inside the window instead of being clipped past its edge.
  const stats = page.getByRole("tab", { name: "Stats" });
  await expect(stats).toBeVisible();
  const tabBox = await stats.boundingBox();
  expect((tabBox?.x ?? 0) + (tabBox?.width ?? 0)).toBeLessThanOrEqual(860);
});

test("the insights grids answer the pane, not the window", async ({ page }) => {
  // Below the window's minimum, which a browser tab can reach: the pane is the window minus the
  // 224px sidebar, so this is a 436px box while the window itself is past `sm:` (640px).
  await page.setViewportSize({ width: 660, height: 700 });
  await page.goto("/?view=insights");

  const pane = insightsPane(page);
  await expect(pane.getByRole("heading", { name: "Vault insights" })).toBeVisible();

  // The precondition, written down so this test cannot quietly stop testing anything: the pane is
  // narrower than the breakpoint the three-column rule asks for.
  const paneWidth = await pane.evaluate((el) => el.clientWidth);
  expect(paneWidth).toBeLessThanOrEqual(448);

  // Two figures across, not the three a viewport rule would have put in this box.
  expect(await columnsOf(pane.locator("dl").first())).toBe(2);

  // Widen towards the window's default and the same grid takes three, because the pane is wider.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(() => pane.evaluate((el) => el.clientWidth)).toBeGreaterThan(448);
  expect(await columnsOf(pane.locator("dl").first())).toBe(3);
});
