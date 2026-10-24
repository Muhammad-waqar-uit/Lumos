/**
 * The Lumos mark: a wand throwing a four-point spark, with three rays ending in nodes.
 *
 * Inline rather than an imported file so the colour comes from the theme: everything is drawn in
 * `currentColor`, so the caller tints it with a token (`text-brand`) and no hue is hardcoded here.
 * The viewBox is cropped to the artwork - the drawn shape sits off-centre in the 200-unit box the
 * tile uses, which leaves an icon-sized slot looking lopsided. It carries no text of its own, so it
 * is hidden from assistive tech - the wordmark beside it names the app.
 */
export function LumosMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="20 40 140 140" aria-hidden="true" focusable="false" className={className}>
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M30 170L96 104" strokeWidth={8} strokeOpacity={0.9} />
        <path d="M30 170L50 150" strokeWidth={8} />
      </g>
      <g stroke="currentColor" strokeWidth={4} strokeLinecap="round">
        <path d="M133 67L146 54" />
        <path d="M133 109L146 122" />
        <path d="M91 67L78 54" />
      </g>
      <g fill="currentColor">
        <circle cx="150" cy="50" r="6" />
        <circle cx="150" cy="126" r="6" />
        <circle cx="74" cy="50" r="6" />
      </g>
      <path
        d="M112 48Q112 88 152 88Q112 88 112 128Q112 88 72 88Q112 88 112 48Z"
        fill="currentColor"
      />
      <circle cx="112" cy="88" r="9" fill="currentColor" />
    </svg>
  );
}
