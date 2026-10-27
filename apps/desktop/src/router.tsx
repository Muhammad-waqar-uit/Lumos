import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
} from "@tanstack/react-router";
import type { ShellView } from "./components/Sidebar";
import App from "./App";

/**
 * What the address bar carries: which pane is open, and which note in it.
 *
 * Those two are "where you are" - the things a reload, the back button or a pasted link must
 * restore. Everything else (filters, notices, pane widths) is session state and stays in React.
 * `view` is omitted for the notes pane, so a plain address means the default.
 */
export interface AppSearch {
  view?: ShellView;
  note?: string;
}

const VIEWS: ShellView[] = ["notes", "graph", "insights", "trash", "profile"];

/**
 * Only known values survive into the app, so a hand-edited address cannot smuggle a pane in,
 * and an empty `note=` is the same as no note at all.
 */
function validateSearch(search: Record<string, unknown>): AppSearch {
  const view =
    typeof search.view === "string" && VIEWS.includes(search.view as ShellView)
      ? (search.view as ShellView)
      : undefined;
  const note = typeof search.note === "string" && search.note !== "" ? search.note : undefined;
  return { ...(view !== undefined ? { view } : {}), ...(note !== undefined ? { note } : {}) };
}

/**
 * One route, because this app has no pages - the panes are search parameters, and the path
 * stays `/` however the address is written. That is what keeps it safe inside a Tauri window,
 * where there is no server to fall back on.
 */
// The layout route carries nothing but the outlet, so the shell itself hangs off the one path
// the app has - which is what lets `useSearch`/`useNavigate` inside it infer the parameter types
// from that route rather than from the root.
const rootRoute = createRootRoute({ component: () => <Outlet /> });

// The one path the app has. Without a route to match it the router renders its own "no match"
// stub, however good the search parameters are - the panes ride on the parameters, never on the
// path, but the path itself still has to exist.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: App,
  validateSearch,
});

const routeTree = rootRoute.addChildren([indexRoute]);

/**
 * A fresh router per call so tests can each start at their own address with a memory history;
 * the app itself creates exactly one, in `main.tsx`.
 */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
