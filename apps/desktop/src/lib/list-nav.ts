/**
 * Moving the note-list selection from the keyboard.
 *
 * The list is a column of buttons, so `Tab` already walks it; `j`/`k` are for reading with a hand on
 * the keyboard, which is why they wrap nothing, stop at both ends, and stand down while a field has
 * focus. The arithmetic is here rather than in the component so it can be tested without a DOM.
 */

/**
 * One step from `current`, clamped to the list rather than wrapping around it: running past the last
 * note should feel like the end of the list, not like a jump back to the top. A `current` outside the
 * list (no selection yet) starts at the near end for the direction being travelled.
 */
export function stepIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  if (current < 0 || current >= length) return delta > 0 ? 0 : length - 1;
  return Math.min(Math.max(current + delta, 0), length - 1);
}

/**
 * Whether a key event belongs to a field the user is typing into.
 *
 * Duck-typed on `tagName` rather than `instanceof HTMLElement` so the rule is testable in Node, where
 * there is no DOM, and so it keeps working in the Tauri webview.
 */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof element.tagName === "string" ? element.tagName.toUpperCase() : "";
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable === true
  );
}

/** The key that moves down a list, or the one that moves up, or nothing. */
export function stepForKey(key: string): number | null {
  if (key === "j") return 1;
  if (key === "k") return -1;
  return null;
}
