import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import path from "node:path";
import { handleMessage } from "./handler.js";
import type { PlanOptions } from "./plan.js";

const AUTH_DIR = path.resolve(process.cwd(), "auth_info");

const userPart = (jid?: string | null) => jid?.split("@")[0]?.split(":")[0] ?? "";

/**
 * Connect to WhatsApp and answer messages. The vault and the allowlist arrive as arguments, so
 * this module never decides where a note lands or whose message is filed - `config.ts` owns those.
 * The same is true of the Ollama `/plan` uses: it arrives too, or the plan module's defaults apply.
 */
export async function startWhatsApp(
  vault: string,
  allowedNumbers: readonly string[],
  plan?: PlanOptions,
) {
  const allowed = new Set(allowedNumbers);
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log(
        "\nScan this QR with the Lumos number: WhatsApp > Linked devices > Link a device\n",
      );
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") console.log("WhatsApp connected.");
    if (connection === "close") {
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log("Logged out. Delete the auth_info folder and restart to link again.");
      } else {
        console.log(`Connection closed (${code}). Reconnecting...`);
        setTimeout(() => startWhatsApp(vault, allowedNumbers, plan).catch(console.error), 3000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue;

      const ids = [jid, (msg.key as any).remoteJidAlt].map(userPart).filter(Boolean);
      if (!ids.some((id) => allowed.has(id))) {
        console.log(`Ignored message from ${ids.join(" / ")} (not in the allowlist)`);
        continue;
      }

      const text =
        msg.message.conversation ??
        msg.message.extendedTextMessage?.text ??
        msg.message.imageMessage?.caption ??
        "";
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
}
