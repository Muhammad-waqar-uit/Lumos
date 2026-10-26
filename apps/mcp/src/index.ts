/**
 * The entry point: an MCP server over stdio, serving one vault.
 *
 * stdout belongs to the protocol, so nothing is written there but protocol messages - one log line
 * would be read as a malformed message and end the session. The vault being served is named on
 * stderr instead, because a client that resolved the wrong directory is the failure worth seeing
 * first, and no note text or key is ever printed.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { resolveVault, VAULT_ENV } from "./vault.js";

const vault = resolveVault();
const server = createServer({ vault });

await server.connect(new StdioServerTransport());
console.error(`lumos mcp: serving the vault at ${vault} (${VAULT_ENV} overrides it)`);
