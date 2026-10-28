import { useEffect, useState } from "react";
import type { WhatsAppStatus } from "@lumos/shared";
import {
  WHATSAPP_DOT,
  WHATSAPP_LABEL,
  lastMessage,
  sinceWhen,
  whatsappAction,
  whatsappSentence,
} from "../lib/whatsapp";

/** How the last read of `/whatsapp` went: a panel has to say "loading" or "failed", never nothing. */
export type WhatsAppRead = "loading" | "ok" | "error";

interface Props {
  /** The daemon's last answer, or null before the first one arrives. */
  status: WhatsAppStatus | null;
  read: WhatsAppRead;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onClose: () => void;
}

/**
 * The WhatsApp link, in the app: whether it is connected, the code a phone can scan, and the one
 * button that stops or starts it.
 *
 * Pairing used to be a page in a browser tab, which meant the app could say nothing about the link
 * it was feeding from. Everything here is the daemon's own report - this panel never talks to
 * WhatsApp - so "connected" means a socket is up, not that a message happened to arrive.
 */
export function WhatsAppPanel({ status, read, onConnect, onDisconnect, onClose }: Props) {
  const [busy, setBusy] = useState<null | "connect" | "disconnect">(null);
  // A refusal from the daemon keeps the panel open with its sentence, the same as every write.
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (kind: "connect" | "disconnect"): Promise<void> => {
    setBusy(kind);
    setFailure(null);
    try {
      await (kind === "connect" ? onConnect() : onDisconnect());
    } catch (err: unknown) {
      setFailure(err instanceof Error ? err.message : "The daemon did not answer.");
    } finally {
      setBusy(null);
    }
  };

  const action = status ? whatsappAction(status) : null;
  const since = status ? sinceWhen(status.since) : "";
  const answered = status ? lastMessage(status) : "";

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-end justify-end bg-background/60 p-4 pb-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="WhatsApp"
        className="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            {status ? (
              <span
                aria-hidden
                className={`inline-block h-1.5 w-1.5 rounded-full ${WHATSAPP_DOT[status.state]}`}
              />
            ) : null}
            WhatsApp
          </h2>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="shrink-0 rounded border border-border px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {read === "error" && !status ? (
          <p className="text-xs leading-relaxed text-amber-400">
            The daemon did not answer, so the link cannot be checked. Notes still open while it is
            down; nothing is being captured.
          </p>
        ) : !status ? (
          <p className="text-xs leading-relaxed text-muted-foreground">Asking the daemon…</p>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="text-foreground">{WHATSAPP_LABEL[status.state]}</span>
              {since ? <span className="opacity-70"> · since {since}</span> : null}
              {answered ? <span className="opacity-70"> · {answered}</span> : null}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {whatsappSentence(status)}
            </p>

            {status.qr ? (
              // The same polarity the daemon's page draws: light modules on dark. Each character
              // covers one module across and two down, so the line height is exactly two character
              // widths - a module that is not square is a module a camera may not read.
              <pre
                aria-hidden="true"
                className="overflow-x-auto rounded bg-black p-3 font-mono text-[13px] leading-[2ch] text-white"
              >
                {status.qr}
              </pre>
            ) : null}

            {action ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run(action)}
                className="rounded-md border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                {busy === "connect"
                  ? "Connecting…"
                  : busy === "disconnect"
                    ? "Disconnecting…"
                    : action === "connect"
                      ? "Connect"
                      : "Disconnect"}
              </button>
            ) : null}

            {read === "error" ? (
              <p className="text-[11px] text-amber-400">
                This may be out of date: the last check failed.
              </p>
            ) : null}
          </>
        )}

        {failure ? <p className="text-[11px] text-amber-400">{failure}</p> : null}

        <p className="border-t border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
          Disconnecting keeps the phone linked, so Connect needs no code. To unlink this device, use
          WhatsApp → Linked devices → Log out.
        </p>
      </div>
    </div>
  );
}
