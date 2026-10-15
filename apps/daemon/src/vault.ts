import path from "node:path";

/**
 * The vault the daemon reads and writes. Resolved once from the environment, and passed
 * into the app factory so no module holds a second copy of it.
 */
export const VAULT = process.env.VAULT_PATH ?? path.resolve(process.cwd(), "../../vault");
