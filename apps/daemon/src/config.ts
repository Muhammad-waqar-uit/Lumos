/**
 * Where the daemon gets its settings: a JSON file, with the environment overriding it.
 *
 * Four settings in four environment variables is workable from a shell and awkward for anything
 * that has to start the daemon itself, which is why a file is read at all. The precedence is
 * environment > file > default, so a one-off `VAULT_PATH=... pnpm dev` keeps working when a file
 * exists, and the file stays the thing a person edits.
 *
 * A relative `vaultPath` resolves against the file that named it, not against whatever directory
 * the daemon happened to start in. Otherwise the same file would point at different places
 * depending on the shortcut that launched it.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface Config {
  /** Absolute path to the vault the routes read and `/message` writes into. */
  vault: string;
  port: number;
  /** Senders whose messages are filed, digits only. Empty means everyone is ignored. */
  allowedNumbers: string[];
  /** False runs the HTTP API alone, which is what `LUMOS_DISABLE_WHATSAPP=1` also means. */
  whatsapp: boolean;
}

/** A setting that cannot be used, with a sentence a person can act on. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** The settings a file may carry. Anything else is a typo, and is refused rather than ignored. */
const FILE_KEYS = ["vaultPath", "port", "allowedNumbers", "whatsapp"] as const;

type FileConfig = Partial<{
  vaultPath: string;
  port: number;
  allowedNumbers: string[];
  whatsapp: boolean;
}>;

export interface LoadOptions {
  /** The environment to read. Injected by the tests, so a suite never depends on the real one. */
  env?: Record<string, string | undefined>;
  /** Where `lumos.config.json` is looked for, and what a relative `VAULT_PATH` is resolved from. */
  cwd?: string;
  /** Injected by the tests to serve a file without touching the disk. */
  readText?: (file: string) => Promise<string>;
}

/**
 * Read the settings. A missing config file is not an error - a daemon with no file has always
 * worked, and still does - while a file that is unreadable, malformed, or names a setting that
 * cannot be used stops the daemon with the reason rather than starting it on a guess.
 */
export async function loadConfig(options: LoadOptions = {}): Promise<Config> {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const readText = options.readText ?? ((file: string) => readFile(file, "utf8"));

  const file = env.LUMOS_CONFIG
    ? path.resolve(cwd, env.LUMOS_CONFIG)
    : path.join(cwd, "lumos.config.json");
  const fromFile = await readConfigFile(file, readText);

  return {
    vault: env.VAULT_PATH
      ? path.resolve(cwd, env.VAULT_PATH)
      : (fromFile.vaultPath ?? path.resolve(cwd, "../../vault")),
    port: env.PORT === undefined ? (fromFile.port ?? 3001) : readPort(env.PORT, "PORT"),
    allowedNumbers:
      env.ALLOWED_NUMBERS === undefined
        ? (fromFile.allowedNumbers ?? [])
        : splitNumbers(env.ALLOWED_NUMBERS),
    whatsapp: env.LUMOS_DISABLE_WHATSAPP === "1" ? false : (fromFile.whatsapp ?? true),
  };
}

async function readConfigFile(
  file: string,
  readText: (file: string) => Promise<string>,
): Promise<FileConfig> {
  let raw: string;
  try {
    raw = await readText(file);
  } catch (err: unknown) {
    // No file is the ordinary case; anything else is a real problem and is not swallowed.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConfigError(`${file} is not valid JSON.`);
  }
  return validate(parsed, path.dirname(file), file);
}

function validate(value: unknown, baseDir: string, file: string): FileConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConfigError(`${file} must contain a JSON object.`);
  }
  const record = value as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!(FILE_KEYS as readonly string[]).includes(key)) {
      throw new ConfigError(
        `${file} has an unknown setting "${key}". Known settings: ${FILE_KEYS.join(", ")}.`,
      );
    }
  }

  const config: FileConfig = {};

  if (record.vaultPath !== undefined) {
    const vaultPath = record.vaultPath;
    if (typeof vaultPath !== "string" || vaultPath.trim() === "") {
      throw new ConfigError(`${file}: "vaultPath" must be a non-empty string.`);
    }
    config.vaultPath = path.resolve(baseDir, vaultPath);
  }

  if (record.port !== undefined) config.port = readPort(record.port, `"port" in ${file}`);

  if (record.allowedNumbers !== undefined) {
    const numbers = record.allowedNumbers;
    if (!Array.isArray(numbers) || numbers.some((n) => typeof n !== "string")) {
      throw new ConfigError(`${file}: "allowedNumbers" must be an array of strings.`);
    }
    config.allowedNumbers = normaliseNumbers(numbers as string[]);
  }

  if (record.whatsapp !== undefined) {
    if (typeof record.whatsapp !== "boolean") {
      throw new ConfigError(`${file}: "whatsapp" must be true or false.`);
    }
    config.whatsapp = record.whatsapp;
  }

  return config;
}

/** A port is a whole number in range, whether it arrived as a string or a number. */
function readPort(value: unknown, label: string): number {
  const port = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError(`${label} must be a whole number between 1 and 65535.`);
  }
  return port;
}

/** `+1 (555) 010-0000`, `1 555 010 0000` and `15550100000` are the same sender. */
function normaliseNumbers(values: readonly string[]): string[] {
  const digits = values.map((value) => value.replace(/[\s+()-]/g, "")).filter(Boolean);
  return [...new Set(digits)];
}

function splitNumbers(text: string): string[] {
  return normaliseNumbers(text.split(","));
}
