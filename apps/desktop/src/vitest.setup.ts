// Vitest setup file for the desktop app.
// Works around jsdom limitations that appear as test warnings.
//
// The "Not implemented: Window's scrollTo()" messages appear because jsdom
// doesn't fully implement the browser API. In the actual Tauri desktop app,
// window.scrollTo() works perfectly fine.

// Mock window.scrollTo to prevent jsdom "Not implemented" warning
if (typeof window !== "undefined") {
  window.scrollTo = window.scrollTo || function () {};
}
