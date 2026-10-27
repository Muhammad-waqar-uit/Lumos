import { useState, type ReactNode } from "react";
import { openLinkInApp } from "../lib/link-viewer";

interface Props {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
}

/** Open an external page in Lumos's isolated webview and show a visible error if opening fails. */
export function OpenLink({ href, children, className, title }: Props) {
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        title={title}
        onClick={() => {
          setError(null);
          void openLinkInApp(href).catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : "Lumos could not open this link.");
          });
        }}
        className={className}
      >
        {children}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-amber-400">
          {error}
        </span>
      ) : null}
    </span>
  );
}
