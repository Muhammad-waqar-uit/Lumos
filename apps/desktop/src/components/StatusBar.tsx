import type { WhatsAppStatus } from "@lumos/shared";
import type { Connection } from "../lib/api";
import { SEARCH_SHORTCUT } from "../lib/search";
import { WHATSAPP_DOT, WHATSAPP_LABEL } from "../lib/whatsapp";

const LABEL: Record<Connection, string> = {
  connecting: "Connecting to daemon…",
  daemon: "Connected to daemon",
  demo: "Daemon offline — showing demo notes",
  qrcode: "QR connect",
};

const DOT: Record<Connection, string> = {
  connecting: "bg-amber-400",
  daemon: "bg-emerald-400",
  demo: "bg-zinc-500",
  qrcode: "bg-indigo-500",
};

/** Something the bar can offer beside the notice it is showing, such as an undo. */
export interface StatusAction {
  label: string;
  onClick: () => void;
}

export function StatusBar({
  connection,
  count,
  onSearch,
  notice,
  onDismissNotice,
  action,
  whatsapp,
  onWhatsApp,
}: {
  connection: Connection;
  count: number;
  onSearch: () => void;
  /** The daemon's report on the WhatsApp link, or null while it is offline or unknown. */
  whatsapp?: WhatsAppStatus | null;
  /** Opens the panel that shows the link's state, its code and its one button. */
  onWhatsApp?: () => void;
  /** Something the app did or could not do, said out loud until it is dismissed. */
  notice?: string | null;
  onDismissNotice?: () => void;
  /** The one way back from what the notice describes, offered next to it. */
  action?: StatusAction | null;
}) {
  // The link is the daemon's, so the chip is only offered while the daemon answers: offline there
  // is nothing to report and a grey chip would be a second way of saying what the bar already says.
  const whatsappChip =
    whatsapp && onWhatsApp ? (
      <button
        type="button"
        onClick={onWhatsApp}
        aria-label={`WhatsApp: ${WHATSAPP_LABEL[whatsapp.state]}`}
        title="WhatsApp capture - its state, the pairing code, and Connect"
        className="flex shrink-0 items-center gap-1.5 rounded border border-border px-1.5 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
      >
        <span
          aria-hidden
          className={`inline-block h-1.5 w-1.5 rounded-full ${WHATSAPP_DOT[whatsapp.state]}`}
        />
        {WHATSAPP_LABEL[whatsapp.state]}
      </button>
    ) : null;

  return (
    <footer className="flex shrink-0 items-center justify-between border-t border-border px-4 py-1 text-[11px] text-muted-foreground">
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[connection]}`} />
        {notice ? (
          <>
            <button
              type="button"
              onClick={onDismissNotice}
              title="Dismiss"
              className="fade-in truncate text-amber-400 hover:underline"
            >
              {notice}
            </button>
            {action ? (
              <button
                type="button"
                onClick={action.onClick}
                className="shrink-0 rounded border border-border px-1.5 py-0.5 text-foreground transition-colors hover:bg-accent"
              >
                {action.label}
              </button>
            ) : null}
          </>
        ) : (
          LABEL[connection]
        )}
      </span>
      <span className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSearch}
          aria-keyshortcuts="Control+K Meta+K"
          className="flex items-center gap-1.5 rounded border border-border px-1.5 py-0.5 transition-colors hover:bg-accent hover:text-foreground"
        >
          Search
          <kbd className="text-[10px] opacity-70">{SEARCH_SHORTCUT}</kbd>
        </button>
        <span className="tabular-nums">
          {count} {count === 1 ? "note" : "notes"}
        </span>
        {whatsappChip}
      </span>
    </footer>
  );
}
