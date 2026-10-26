import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import path from "node:path";
import { bridgeEnabled, bridgeReport, bridgeState, type BridgeControl } from "./bridge.js";
import { handleMessage } from "./handler.js";
import type { PlanOptions } from "./plan.js";
import { clearQr, setQr } from "./qr.js";

const AUTH_DIR = path.resolve(process.cwd(), "auth_info");

/** How long to wait before trying again after the link drops or will not start. */
const RETRY_MS = 3000;

const userPart = (jid?: string | null) => jid?.split("@")[0]?.split(":")[0] ?? "";

/** The HTTP status Baileys buried in a disconnect error, without trusting its shape. */
function statusCodeOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const output = (err as { output?: { statusCode?: unknown } }).output;
  return typeof output?.statusCode === "number" ? output.statusCode : undefined;
}

/** The text of a message, from any of the shapes WhatsApp puts one in. */
function textOf(message: {
  conversation?: string | null;
  extendedTextMessage?: { text?: string | null } | null;
  imageMessage?: { caption?: string | null } | null;
}): string {
  return (
    message.conversation ?? message.extendedTextMessage?.text ?? message.imageMessage?.caption ?? ""
  );
}

/**
 * Connect to WhatsApp and answer messages, as something the daemon can also ask about.
 *
 * The vault and the allowlist arrive as arguments, so this module never decides where a note lands
 * or whose message is filed - `config.ts` owns those. The same is true of the Ollama `/plan` uses:
 * it arrives too, or the plan module's defaults apply.
 *
 * The link outlives one socket: WhatsApp drops it, this reconnects. What the app is told is the
 * state in `bridge.ts`, so the status bar can say "linked" without asking the socket anything.
 */
export function createWhatsAppBridge(
  vault: string,
  allowedNumbers: readonly string[],
  plan?: PlanOptions,
): BridgeControl {
  const allowed = new Set(allowedNumbers);
  let socket: WASocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  // Set while a socket is being built, so two clicks on Connect cannot make two.
  let opening = false;
  // Set when the link was closed on purpose: the close handler must not reconnect after it.
  let paused = false;

  function cancelRetry(): void {
    if (retry !== null) clearTimeout(retry);
    retry = null;
  }

  /** Try again shortly, unless the link was paused while this was pending. */
  function scheduleRetry(): void {
    cancelRetry();
    retry = setTimeout(() => {
      retry = null;
      void open();
    }, RETRY_MS);
    // A pending reconnect must not keep the process alive on its own.
    retry.unref?.();
  }

  async function open(): Promise<void> {
    if (opening) return;
    opening = true;
    paused = false;
    bridgeEnabled(true);
    bridgeState("starting");
    try {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({ version, auth: state, logger: pino({ level: "silent" }) });
      socket = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
        // A socket that has already been replaced says nothing about the current state.
        if (socket !== sock) return;

        if (qr) {
          // Held for `GET /whatsapp` as well as printed here, because whoever pairs the phone may be
          // looking at the app rather than at this terminal.
          setQr(qr);
          // Every rotation re-states "waiting": the state is unchanged, so `since` keeps the moment
          // pairing actually began rather than the moment this code arrived.
          bridgeState("waiting");
          console.log(
            "\nScan this QR with the Lumos number: WhatsApp > Linked devices > Link a device\n",
          );
          qrcode.generate(qr, { small: true });
        }
        if (connection === "open") {
          clearQr();
          bridgeState("connected");
          console.log("WhatsApp connected.");
        }
        if (connection === "close") {
          socket = null;
          clearQr();
          const code = statusCodeOf(lastDisconnect?.error);

          if (paused) return;
          if (code === DisconnectReason.loggedOut) {
            bridgeState(
              "logged-out",
              "The phone unlinked this device. Connect again and scan a new code.",
            );
            console.log("Logged out. Connect again from the app, or delete auth_info to relink.");
            return;
          }
          bridgeState("disconnected", `Connection closed (${code ?? "unknown"}). Reconnecting…`);
          console.log(`Connection closed (${code}). Reconnecting...`);
          scheduleRetry();
        }
      });

      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        for (const msg of messages) {
          if (msg.key.fromMe || !msg.message) continue;
          const jid = msg.key.remoteJid;
          if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue;

          const alt = (msg.key as { remoteJidAlt?: string | null }).remoteJidAlt;
          const ids = [jid, alt].map(userPart).filter(Boolean);
          if (!ids.some((id) => allowed.has(id))) {
            console.log(`Ignored message from ${ids.join(" / ")} (not in the allowlist)`);
            continue;
          }

          const text = textOf(msg.message);
          if (!text) {
            console.log("Skipped a non-text message (media comes later).");
            continue;
          }

          try {
            const reply = await handleMessage(text, vault, { plan });
            await sock.sendMessage(jid, { text: reply });
          } catch (err) {
            console.error(err);
            await sock.sendMessage(jid, { text: "Something went wrong saving that." });
          }
        }
      });
    } catch (err: unknown) {
      // The sentence, never the error: a credentials read carries the auth directory's path.
      bridgeState("error", "The WhatsApp link could not start. Retrying…");
      console.error("WhatsApp link failed to start:", err instanceof Error ? err.name : "unknown");
      scheduleRetry();
    } finally {
      opening = false;
    }
  }

  return {
    status: () => bridgeReport(),

    /** Start the link, or do nothing when it is already up. */
    connect: async () => {
      if (socket || opening) return;
      cancelRetry();
      await open();
    },

    /**
     * Stop answering messages without unlinking the phone.
     *
     * The pairing survives in `auth_info`, so connecting again needs no scan. Unlinking is the
     * phone's job (WhatsApp > Linked devices > Log out), and the daemon notices when it happens -
     * nothing here can unlink a device the person still holds.
     */
    disconnect: async () => {
      paused = true;
      cancelRetry();
      const current = socket;
      socket = null;
      clearQr();
      try {
        if (current) await current.end(undefined);
        bridgeState("disconnected", "Stopped from the app. The phone is still linked.");
      } catch (err: unknown) {
        bridgeState("error", "The WhatsApp link could not be closed cleanly.");
        console.error("WhatsApp link failed to stop:", err instanceof Error ? err.name : "unknown");
      }
    },
  };
}
