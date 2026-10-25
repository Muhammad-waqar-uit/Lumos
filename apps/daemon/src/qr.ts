/**
 * The pairing code WhatsApp is waiting for, held between the socket and `GET /qrcode`.
 *
 * Baileys emits a code that rotates every few seconds, and a person pairing a phone may be looking
 * at the app rather than at the terminal the daemon was started in. One small module owns the
 * hand-off, so the socket does not have to know about HTTP and the route does not have to know about
 * Baileys. The code is a session secret: it is handed to whoever asks for the page and never logged.
 */
import qrcode from "qrcode-terminal";

let pending: string | null = null;

/** Hold the code the socket just emitted, replacing the one before it. */
export function setQr(code: string): void {
  pending = code;
}

/** Forget it: once the phone is linked there is nothing left to scan. */
export function clearQr(): void {
  pending = null;
}

/** The code a pairing phone should scan right now, or null when there is nothing to pair. */
export function pendingQr(): string | null {
  return pending;
}

/**
 * The code as half-block characters, for a dark `<pre>`.
 *
 * `qrcode-terminal` draws in two possible polarities, and only one of them is text: the plain mode
 * is ANSI background colours, which a page cannot use, while the small mode draws the *light*
 * modules as `█` and leaves the dark ones as spaces. That is why the page shows it light-on-dark -
 * rendered backwards it would be an inverted code, which a phone may refuse to read.
 */
export function qrToText(code: string): string {
  let text = "";
  qrcode.generate(code, { small: true }, (drawn: string) => {
    text = drawn;
  });
  return text.trimEnd();
}
