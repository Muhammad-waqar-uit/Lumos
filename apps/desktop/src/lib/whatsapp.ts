import type { WhatsAppState, WhatsAppStatus } from "@lumos/shared";

/**
 * What the app says about the WhatsApp link, in the words it has room for.
 *
 * The words live here rather than in the two components that show them, so the status bar and the
 * panel cannot disagree about whether "disconnected" means the phone was unlinked, and so the
 * sentences can be pinned by a test without rendering anything.
 */

/** The short label the status bar shows beside the dot. */
export const WHATSAPP_LABEL: Record<WhatsAppState, string> = {
  off: "WhatsApp off",
  starting: "WhatsApp starting…",
  waiting: "Pair WhatsApp",
  connected: "WhatsApp linked",
  disconnected: "WhatsApp disconnected",
  "logged-out": "WhatsApp unlinked",
  error: "WhatsApp problem",
};

/**
 * The dot's colour: green only while messages are actually being filed, amber while something is
 * waiting on a person, grey when nothing will happen until someone acts, red when it failed.
 */
export const WHATSAPP_DOT: Record<WhatsAppState, string> = {
  connected: "bg-emerald-400",
  starting: "bg-amber-400",
  waiting: "bg-indigo-500",
  off: "bg-zinc-500",
  disconnected: "bg-zinc-500",
  "logged-out": "bg-amber-400",
  error: "bg-red-400",
};

/**
 * The longer sentence the panel shows under the state.
 *
 * The daemon's own reason wins when it has one: it is the only thing that knows why a socket
 * closed, and "something went wrong" in place of that would be a worse answer than none.
 */
export function whatsappSentence(status: WhatsAppStatus): string {
  switch (status.state) {
    case "off":
      return "Capture is switched off for this daemon, so messages are not being read. Start it without LUMOS_DISABLE_WHATSAPP=1 to file notes from WhatsApp.";
    case "starting":
      return "Connecting to WhatsApp…";
    case "waiting":
      return "Scan this with the Lumos phone: WhatsApp → Linked devices → Link a device.";
    case "connected":
      return "Messages from the allowed numbers are being filed into the vault.";
    case "disconnected":
      return status.error ?? "Not connected. The phone is still linked, so Connect needs no code.";
    case "logged-out":
      return (
        status.error ?? "This device was unlinked from the phone. Connect again to scan a new code."
      );
    case "error":
      return status.error ?? "The link failed. Connect to try again.";
  }
}

/** Whether the panel should offer Connect, Disconnect, or neither. */
export function whatsappAction(status: WhatsAppStatus): "connect" | "disconnect" | null {
  if (!status.enabled) return null;
  if (status.state === "connected" || status.state === "waiting") return "disconnect";
  if (status.state === "starting") return null;
  return "connect";
}

/**
 * When the current state began, for the panel's "for 3 minutes" line.
 *
 * A timestamp from another day says the day rather than a clock time, because "linked at 09:12" is
 * not useful about something that happened last week. An unreadable date answers nothing rather
 * than "Invalid Date", which is the kind of detail that makes an app look broken.
 */
export function sinceWhen(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";

  const sameDay = then.toDateString() === now.toDateString();
  if (sameDay) return then.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
