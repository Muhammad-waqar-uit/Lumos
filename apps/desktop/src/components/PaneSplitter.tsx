import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  PANE_DEFAULT,
  PANE_MAX,
  PANE_MIN,
  PANE_STEP,
  clampPaneWidth,
  nudgePaneWidth,
} from "../lib/pane-size";

interface Props {
  /** Current width of the pane to the left of the splitter. */
  width: number;
  onWidth: (width: number) => void;
}

/**
 * The handle between the note list and the note.
 *
 * A splitter is one of those controls that is unusable if it only works with a mouse, so it is a
 * real separator: focusable, with the bounds exposed to assistive technology, arrow keys for a step
 * and Home for the default. Dragging listens on the window rather than the handle, because the
 * pointer leaves a 6px target almost immediately and the drag must not stop when it does.
 */
export function PaneSplitter({ width, onWidth }: Props) {
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    // Ignore a secondary button: a right-click is a context menu, not a drag.
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = clampPaneWidth(width);

    const move = (moveEvent: PointerEvent): void => {
      onWidth(clampPaneWidth(startWidth + moveEvent.clientX - startX));
    };
    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onWidth(nudgePaneWidth(width, -PANE_STEP));
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onWidth(nudgePaneWidth(width, PANE_STEP));
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      onWidth(PANE_DEFAULT);
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the note list"
      aria-valuemin={PANE_MIN}
      aria-valuemax={PANE_MAX}
      aria-valuenow={clampPaneWidth(width)}
      aria-valuetext={`${clampPaneWidth(width)} pixels`}
      tabIndex={0}
      title="Drag to resize, double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={() => onWidth(PANE_DEFAULT)}
      onKeyDown={onKeyDown}
      className="group relative w-2 shrink-0 cursor-col-resize touch-none bg-border transition-colors hover:bg-ring/50 focus:outline-none focus-visible:bg-ring"
    >
      {/* A wider invisible target than the visible line, without shifting the layout. */}
      <span aria-hidden="true" className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}
