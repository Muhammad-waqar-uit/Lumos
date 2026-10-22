/**
 * The daemon's entry point: read the settings, build the app, bind loopback, then attach WhatsApp.
 *
 * The routes themselves live in `app.ts` and the settings in `config.ts`; this file only orders
 * those two and decides whether the WhatsApp bridge runs, so nothing here needs to be imported by
 * a test.
 */
import { createApp } from "./app.js";
import { type Config, ConfigError, loadConfig } from "./config.js";
import { startWhatsApp } from "./whatsapp.js";

/**
 * A setting that cannot be used is the one failure worth printing as a sentence: the message already
 * names the setting and says why, and a stack trace over it helps nobody edit a JSON file. Any other
 * failure still throws, so nothing unexpected is swallowed here.
 */
async function readSettings(): Promise<Config> {
  try {
    return await loadConfig();
  } catch (err: unknown) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(err.message);
    process.exit(1);
  }
}

const config = await readSettings();

const app = await createApp({ vault: config.vault, logger: true });

await app.listen({ host: "127.0.0.1", port: config.port });

if (config.whatsapp) {
  startWhatsApp(config.vault, config.allowedNumbers).catch((err) => app.log.error(err));
} else {
  app.log.info("WhatsApp bridge disabled (LUMOS_DISABLE_WHATSAPP=1 or whatsapp: false)");
}
