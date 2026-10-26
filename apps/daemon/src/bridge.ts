/**
 * How the WhatsApp link stands, held between the socket and the routes that report it.
 *
 * The socket owns a connection to WhatsApp; the desktop only ever asks questions about it. One small
 * module holds the answer, so `whatsapp.ts` does not have to know about HTTP and the routes do not
 * have to know about Baileys - the same split `qr.ts` makes for the pairing code. It is state only:
 * no socket, no timers, nothing to clean up when a test imports it.
 */
import type { WhatsAppState } from "@lumos/shared";

/** The report without the drawn code: routes add that, because the code is a session secret. */
export interface BridgeReport {
  enabled: boolean;
  state: WhatsAppState;
  since: string | null;
  error: string | null;
}

/**
 * What the routes drive. The real one is `createWhatsAppBridge`; the daemon answers with a bridge
 * that is switched off when capture was disabled, so the app can say which of the two it is.
 */
export interface BridgeControl {
  status: () => BridgeReport;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

/** Capture off by configuration: there is no socket, and nothing Connect could start. */
export const DISABLED_BRIDGE: BridgeControl = {
  status: () => ({ enabled: false, state: "off", since: null, error: null }),
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
};

/** The sentence the routes answer when a request asks to connect a bridge that is not enabled. */
export const DISABLED_SENTENCE =
  "WhatsApp capture is switched off for this daemon (LUMOS_DISABLE_WHATSAPP=1 or whatsapp: false).";

let report: BridgeReport = { enabled: false, state: "off", since: null, error: null };

/** What the socket is doing right now. */
export function bridgeReport(): BridgeReport {
  return report;
}

/** Say whether capture is on, without pretending anything has connected yet. */
export function bridgeEnabled(enabled: boolean): BridgeReport {
  report = { ...report, enabled };
  return report;
}

/**
 * Move to a new state, keeping the moment it began.
 *
 * `since` is stamped only when the state actually changes: a reconnect that fails twice in the same
 * state still means "down since then", and a clock that jumps on every retry tells nobody anything.
 * A reason is optional and rides with the state, so the app can say why rather than only that.
 */
export function bridgeState(
  state: WhatsAppState,
  error: string | null = null,
  now: Date = new Date(),
): BridgeReport {
  const changed = state !== report.state;
  report = {
    ...report,
    state,
    error,
    since: changed || report.since === null ? now.toISOString() : report.since,
  };
  return report;
}

/** Back to the beginning, for the tests that import this module once and use it many times. */
export function resetBridge(): void {
  report = { enabled: false, state: "off", since: null, error: null };
}
