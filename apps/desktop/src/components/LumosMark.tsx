/**
 * The Lumos mark: a lamp seen from above, three spokes and a lit centre.
 *
 * Inline rather than an imported file so the colour comes from the theme: everything is drawn in
 * `currentColor`, so the caller tints it with a token (`text-brand`) and no hue is hardcoded here.
 * It carries no text of its own, so it is hidden from assistive tech - the wordmark beside it names
 * the app.
 */
export function LumosMark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" className={className}>
      <g fill="none" stroke="currentColor" strokeWidth={7} strokeLinecap="round">
        <circle cx="60" cy="60" r="46" />
        <path d="M60 60L60 14M60 60L99.8 83M60 60L20.2 83" strokeWidth={5} />
      </g>
      <g fill="currentColor">
        <circle cx="60" cy="60" r="13" />
        <circle cx="60" cy="14" r="8" />
        <circle cx="99.8" cy="83" r="8" />
        <circle cx="20.2" cy="83" r="8" />
      </g>
    </svg>
  );
}
