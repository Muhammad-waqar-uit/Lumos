import { DAEMON_BASE } from "./api";

/**
 * Why the shell cannot read the vault, in terms a person can act on.
 *
 * "Daemon offline" was the whole story for too long. From inside the webview a stopped daemon and a
 * daemon whose CORS allow-list refuses this window look identical: both are a `TypeError` from
 * `fetch`, so the app fell back to the demo vault and could not say which one it was - which is how
 * *Daemon offline - showing demo notes* ended up beside a daemon that was answering every request.
 *
 * The probe below asks `/health` once, and then - only if that failed - asks the same port again in
 * a mode the browser does not police. An opaque answer proves something served the request, so
 * "nothing is listening" and "something answered and then refused us" stop being the same message.
 */
export type DaemonCause = "stopped" | "origin" | "error" | "slow";

export interface DaemonDiagnosis {
  cause: DaemonCause;
  /** What was found, in one sentence the status bar has room for. */
  title: string;
  /** The one thing to try next. */
  action: string;
}

/** What one probe learned. `blocked` is the case that takes two requests to see. */
export type DaemonProbe =
  | { kind: "answered"; status: number }
  | { kind: "blocked"; origin: string }
  | { kind: "refused" }
  | { kind: "timeout" };

/**
 * How long a probe waits before it calls the daemon slow.
 *
 * Deliberately not tight: a *refused* loopback connection is not instant. Measured in Chromium on
 * Windows against a closed port, `Failed to fetch` took 711 ms, and 1601 ms in `no-cors` mode. A
 * 1.5-second budget therefore reported "did not answer within 1.5 seconds" for a port that was
 * simply closed - a false finding, which is worse than a slow one. Four seconds clears that with
 * room to spare, and the demo vault is already on screen while the probe runs.
 */
const PROBE_TIMEOUT_MS = 4000;

const HOST = DAEMON_BASE.replace(/^https?:\/\//, "");

/** Read the daemon's health route the way the app reads everything else. */
export async function probeDaemon(): Promise<DaemonProbe> {
  try {
    const res = await fetch(`${DAEMON_BASE}/health`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return { kind: "answered", status: res.status };
  } catch (err: unknown) {
    // A stopped daemon and a refused origin reach this line as the same `TypeError`, so the port is
    // asked once more with CORS out of the picture: an opaque answer means a server is there.
    if (await answersWithoutCors()) return { kind: "blocked", origin: windowOrigin() };
    return { kind: isTimeout(err) ? "timeout" : "refused" };
  }
}

/** True when something on the port answered at all, whatever it said and whoever it refused. */
async function answersWithoutCors(): Promise<boolean> {
  try {
    await fetch(`${DAEMON_BASE}/health`, {
      mode: "no-cors",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return true;
  } catch {
    // Both probes failing is the finding - nothing is listening - not an error to handle.
    return false;
  }
}

/**
 * The address this window was served from, which is what a CORS allow-list has to contain.
 *
 * In the packaged Windows app this is `http://tauri.localhost`; in the dev server it is
 * `http://localhost:1420`. Named in the diagnosis because it is the one fact a bug report needs.
 */
function windowOrigin(): string {
  return typeof window === "undefined" ? "this window" : window.location.origin;
}

function isTimeout(err: unknown): boolean {
  // `AbortSignal.timeout` rejects with a DOMException, which is not an `instanceof Error`.
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: unknown }).name === "TimeoutError"
  );
}

/** Turn what the probe found into the sentence the status bar shows. */
export function diagnose(probe: DaemonProbe): DaemonDiagnosis {
  switch (probe.kind) {
    case "blocked":
      return {
        cause: "origin",
        title: `The daemon answered, then refused ${probe.origin}.`,
        action:
          "That address is missing from its CORS allow-list, so the browser throws every answer " +
          "away. It is a fault in Lumos, not in this setup; its log shows the requests arriving.",
      };
    case "answered":
      return {
        cause: "error",
        title: `The daemon answered HTTP ${probe.status} instead of the vault.`,
        action: "Its log names the cause: daemon.log in the Lumos app-data folder.",
      };
    case "timeout":
      return {
        cause: "slow",
        title: `The daemon did not answer within ${PROBE_TIMEOUT_MS / 1000} seconds.`,
        action:
          "Lumos asks again every two seconds; if the sentence stays, reopen the app so the " +
          "daemon starts beside it.",
      };
    case "refused":
      return {
        cause: "stopped",
        title: `Nothing is listening on ${HOST}.`,
        action:
          "The daemon starts with the window, so open Lumos again. After a force-quit its " +
          "daemon can still hold that port, and the next launch reuses it.",
      };
  }
}

/**
 * Probe and explain in one call, so the shell has one path from a failed read to a sentence.
 *
 * Concurrent callers share one probe. The shell retries every two seconds and a probe against a
 * dead port can take longer than that, so without this every retry would start two more requests,
 * and the pile would make each later refusal slower and less honest.
 */
let inFlight: Promise<DaemonDiagnosis> | null = null;

export function diagnoseDaemon(): Promise<DaemonDiagnosis> {
  inFlight ??= probeDaemon()
    .then(diagnose)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
