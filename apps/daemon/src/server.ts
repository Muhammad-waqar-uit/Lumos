/**
 * The daemon's entry point: build the app, bind loopback, then attach WhatsApp.
 *
 * The routes themselves live in `app.ts`; this file only decides where the vault is and
 * which port to listen on, so nothing here needs to be imported by a test.
 */
import { createApp } from "./app.js";
import { startWhatsApp } from "./whatsapp.js";
import { VAULT } from "./vault.js";

const app = await createApp({ vault: VAULT, logger: true });

await app.listen({ host: "127.0.0.1", port: Number(process.env.PORT ?? 3001) });

if (process.env.LUMOS_DISABLE_WHATSAPP !== "1") {
  startWhatsApp(VAULT).catch((err) => app.log.error(err));
} else {
  app.log.info("WhatsApp bridge disabled (LUMOS_DISABLE_WHATSAPP=1)");
}
