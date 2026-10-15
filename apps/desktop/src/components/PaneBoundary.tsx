import { Component, type ReactNode } from "react";

interface Props {
  /** What the pane is, for the message. */
  title: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * A pane that throws, or a lazily loaded pane whose chunk fails to arrive, must not
 * take the whole shell down with it: the rest of the app keeps working and the user is
 * told what happened.
 */
export class PaneBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-foreground">{this.props.title} could not load.</p>
        <p className="max-w-md text-xs text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-accent hover:text-foreground"
        >
          Reload the app
        </button>
      </div>
    );
  }
}
