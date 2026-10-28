import { useEffect, useState } from "react";

/**
 * ThemeToggle - A button that toggles between light and dark theme.
 *
 * The theme is stored in localStorage so it persists across sessions.
 * The CSS uses `color-scheme: dark` in the root and the `theme` class
 * toggles between light and dark.
 */
export function ThemeToggle() {
  // @ts-ignore
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("lumos.theme");
    if (saved === "light") return "light";
    if (saved === "dark") return "dark";
    return "dark";
  });

  // Save theme to localStorage on change
  useEffect(() => {
    localStorage.setItem("lumos.theme", theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      aria-label="Toggle theme"
      title="Toggle between light and dark theme"
      className="flex items-center gap-2 rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      {theme === "dark" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M17.293 13.293a8 8 0 01-11.313-11.313L7 10l3.293 3.293A8 8 0 010 9.707a8.02 8.02 0 011.55-.143l.195.195a6 6 0 006.968 6.968l.195.195a8 8 0 01-.143 1.55l-.195-.195zM7 14a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M10 2a1 1 0 011 1h4a1 1 0 110 2h-4a1 1 0 01-1-1zm0 6a1 1 0 011 1h2a1 1 0 110 2h-2a1 1 0 01-1-1zm0 6a1 1 0 011 1h4a1 1 0 110 2h-4a1 1 0 01-1-1zm-7-10a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zm0 6a1 1 0 011 1h4a1 1 0 110 2h-4a1 1 0 01-1-1zm0 6a1 1 0 011 1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" />
        </svg>
      )}
      <span className="hidden sm:inline">Moon</span>
    </button>
  );
}
