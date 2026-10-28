import { spawnSync } from "node:child_process";
import { copyFileSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, "../../..");
const bundleDirectory = path.resolve(scriptDirectory, "../../../.lumos-daemon-runtime-build");

rmSync(bundleDirectory, { recursive: true, force: true });

const packageManager = process.platform === "win32" ? process.env.npm_execpath : "pnpm";
if (!packageManager) throw new Error("The package manager path is not available.");
const packageManagerIsJs = process.platform === "win32" && packageManager.endsWith(".js");
const packageManagerArgs = [
  "deploy",
  "--filter",
  "daemon",
  "--prod",
  "--legacy",
  "--node-linker=hoisted",
  "--offline",
  bundleDirectory,
];
const deploy = spawnSync(
  packageManagerIsJs ? process.execPath : packageManager,
  [...(packageManagerIsJs ? [packageManager] : []), ...packageManagerArgs],
  { cwd: workspaceRoot, stdio: "inherit" },
);

if (deploy.error) throw deploy.error;
if (deploy.status !== 0) process.exit(deploy.status ?? 1);

// `pnpm deploy` copies package-local files; never ship a developer's linked-device session.
rmSync(path.join(bundleDirectory, "auth_info"), { recursive: true, force: true });
rmSync(path.join(bundleDirectory, "README.md"), { force: true });
rmSync(path.join(bundleDirectory, "tsconfig.json"), { force: true });
rmSync(path.join(bundleDirectory, "vitest-report.json"), { force: true });
for (const entry of readdirSync(path.join(bundleDirectory, "src"))) {
  if (entry.endsWith(".test.ts")) rmSync(path.join(bundleDirectory, "src", entry));
}

const runtimeName = process.platform === "win32" ? "node.exe" : "node";
const runtimePath = path.join(bundleDirectory, runtimeName);
copyFileSync(process.execPath, runtimePath);

console.log(
  `Packaged the daemon and Node ${process.versions.node} (${Math.round(statSync(runtimePath).size / 1024 / 1024)} MiB runtime) for Tauri.`,
);
