import path from "node:path";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config";

/** A directory standing in for the daemon's cwd, so no test resolves against the real one. */
const CWD = path.resolve("/work/daemon");

/** Serve a config file from memory, so the suite never writes one. */
function withFile(text: string): (file: string) => Promise<string> {
  return async () => text;
}

/** No config file on disk, which is the ordinary case. */
const noFile = async (): Promise<string> => {
  const err: NodeJS.ErrnoException = new Error("ENOENT: no such file or directory");
  err.code = "ENOENT";
  throw err;
};

describe("loadConfig - where the defaults come from", () => {
  it("runs on the defaults when there is no file and no environment", async () => {
    const config = await loadConfig({ env: {}, cwd: CWD, readText: noFile });

    expect(config).toEqual({
      vault: path.resolve(CWD, "../../vault"),
      port: 3001,
      allowedNumbers: [],
      whatsapp: true,
    });
  });

  it("reads the file's settings", async () => {
    const file = JSON.stringify({
      vaultPath: "notes",
      port: 4100,
      allowedNumbers: ["15550100000"],
      whatsapp: false,
    });

    const config = await loadConfig({ env: {}, cwd: CWD, readText: withFile(file) });

    expect(config).toEqual({
      vault: path.resolve(CWD, "notes"),
      port: 4100,
      allowedNumbers: ["15550100000"],
      whatsapp: false,
    });
  });

  it("resolves a relative vaultPath against the file, not the working directory", async () => {
    const config = await loadConfig({
      env: { LUMOS_CONFIG: "config/settings.json" },
      cwd: CWD,
      readText: withFile(JSON.stringify({ vaultPath: "../vault" })),
    });

    // The file sits in CWD/config, so "../vault" lands in CWD/vault - not in CWD/../vault, which
    // is where the same text would point if it were resolved against the working directory.
    expect(config.vault).toBe(path.resolve(CWD, "vault"));
  });

  it("finds the file at LUMOS_CONFIG when it is set", async () => {
    const asked: string[] = [];
    await loadConfig({
      env: { LUMOS_CONFIG: "elsewhere.json" },
      cwd: CWD,
      readText: async (file) => {
        asked.push(file);
        return "{}";
      },
    });

    expect(asked).toEqual([path.resolve(CWD, "elsewhere.json")]);
  });
});

describe("loadConfig - the environment wins", () => {
  const file = JSON.stringify({
    vaultPath: "notes",
    port: 4100,
    allowedNumbers: ["15550100000"],
    whatsapp: true,
  });

  it("overrides the file's vault, port, allowlist and bridge", async () => {
    const config = await loadConfig({
      env: {
        VAULT_PATH: "from-env",
        PORT: "4200",
        ALLOWED_NUMBERS: "15550000001, 15550000002",
        LUMOS_DISABLE_WHATSAPP: "1",
      },
      cwd: CWD,
      readText: withFile(file),
    });

    expect(config).toEqual({
      vault: path.resolve(CWD, "from-env"),
      port: 4200,
      allowedNumbers: ["15550000001", "15550000002"],
      whatsapp: false,
    });
  });

  it("keeps the file's allowlist when only the port is set, since they are separate settings", async () => {
    const config = await loadConfig({
      env: { PORT: "4200" },
      cwd: CWD,
      readText: withFile(file),
    });

    expect(config.allowedNumbers).toEqual(["15550100000"]);
    expect(config.port).toBe(4200);
  });

  it("reads the same number however it was written", async () => {
    const config = await loadConfig({
      env: { ALLOWED_NUMBERS: "+1 (555) 010-0000, 15550100000 ,," },
      cwd: CWD,
      readText: noFile,
    });

    expect(config.allowedNumbers).toEqual(["15550100000"]);
  });
});

describe("loadConfig - a setting that cannot be used", () => {
  it("names an unknown setting instead of ignoring it", async () => {
    await expect(
      loadConfig({ env: {}, cwd: CWD, readText: withFile('{"prot": 3001}') }),
    ).rejects.toThrow(ConfigError);
    await expect(
      loadConfig({ env: {}, cwd: CWD, readText: withFile('{"prot": 3001}') }),
    ).rejects.toThrow(/unknown setting "prot"/);
  });

  it("refuses a port outside the range, wherever it came from", async () => {
    for (const PORT of ["0", "70000", "three thousand", ""]) {
      await expect(loadConfig({ env: { PORT }, cwd: CWD, readText: noFile })).rejects.toThrow(
        /PORT must be a whole number between 1 and 65535/,
      );
    }

    await expect(
      loadConfig({ env: {}, cwd: CWD, readText: withFile('{"port": 70000}') }),
    ).rejects.toThrow(/"port" in .*between 1 and 65535/);
  });

  it("refuses a file that is not an object, or not JSON", async () => {
    for (const text of ["[]", '"a string"', "null", "{oops"]) {
      await expect(loadConfig({ env: {}, cwd: CWD, readText: withFile(text) })).rejects.toThrow(
        ConfigError,
      );
    }
  });

  it("refuses a vaultPath or allowlist of the wrong shape", async () => {
    for (const text of [
      '{"vaultPath": ""}',
      '{"vaultPath": 3}',
      '{"allowedNumbers": "15550100000"}',
      '{"allowedNumbers": [15550100000]}',
      '{"whatsapp": "yes"}',
    ]) {
      await expect(loadConfig({ env: {}, cwd: CWD, readText: withFile(text) })).rejects.toThrow(
        ConfigError,
      );
    }
  });

  it("surfaces a file it cannot read for a reason other than being missing", async () => {
    const denied: NodeJS.ErrnoException = new Error("EACCES: permission denied");
    denied.code = "EACCES";

    await expect(
      loadConfig({
        env: {},
        cwd: CWD,
        readText: async () => Promise.reject(denied),
      }),
    ).rejects.toThrow(/permission denied/);
  });
});
