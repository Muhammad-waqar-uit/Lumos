// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAEMON_BASE } from "./api";
import { diagnose, diagnoseDaemon, probeDaemon } from "./diagnostics";

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A fetch that answers in the order it is given, so the two probes can disagree. */
function fetchSequence(...steps: Array<() => Promise<{ status: number }>>) {
  return vi.fn(async () => {
    const step = steps.shift();
    if (!step) throw new Error("fetch called more often than the test expected");
    return step();
  });
}

describe("probeDaemon", () => {
  it("reports the status the daemon answered", async () => {
    vi.stubGlobal(
      "fetch",
      fetchSequence(async () => ({ status: 200 })),
    );

    await expect(probeDaemon()).resolves.toEqual({ kind: "answered", status: 200 });
  });

  it("reports an error status rather than calling the daemon offline", async () => {
    vi.stubGlobal(
      "fetch",
      fetchSequence(async () => ({ status: 503 })),
    );

    await expect(probeDaemon()).resolves.toEqual({ kind: "answered", status: 503 });
  });

  // The fact this feature exists for: inside the webview a refused origin and a stopped daemon are
  // the same `TypeError`. The opaque second request is what tells them apart.
  it("calls it blocked when the first request fails but the port still answers", async () => {
    const fetchMock = fetchSequence(
      async () => {
        throw new TypeError("Failed to fetch");
      },
      async () => ({ status: 0 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const probe = await probeDaemon();

    expect(probe).toEqual({ kind: "blocked", origin: window.location.origin });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]).toEqual([
      `${DAEMON_BASE}/health`,
      expect.objectContaining({ mode: "no-cors" }),
    ]);
  });

  it("says refused when nothing answers at all", async () => {
    vi.stubGlobal(
      "fetch",
      fetchSequence(
        async () => {
          throw new TypeError("Failed to fetch");
        },
        async () => {
          throw new TypeError("Failed to fetch");
        },
      ),
    );

    await expect(probeDaemon()).resolves.toEqual({ kind: "refused" });
  });

  it("calls a timeout a timeout, not a refusal", async () => {
    const timedOut = async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    };
    vi.stubGlobal("fetch", fetchSequence(timedOut, timedOut));

    await expect(probeDaemon()).resolves.toEqual({ kind: "timeout" });
  });
});

describe("diagnose", () => {
  it("names the address nothing is listening on, and what starts it", () => {
    const said = diagnose({ kind: "refused" });

    expect(said.cause).toBe("stopped");
    expect(said.title).toContain("127.0.0.1:3001");
    expect(said.action).toMatch(/open Lumos again/i);
  });

  it("names the origin a daemon refused, and says whose fault it is", () => {
    const said = diagnose({ kind: "blocked", origin: "http://tauri.localhost" });

    expect(said.cause).toBe("origin");
    expect(said.title).toContain("http://tauri.localhost");
    // A person cannot fix a missing allow-list entry; saying so is the point.
    expect(said.action).toMatch(/fault in Lumos/i);
  });

  it("carries the status code it was given", () => {
    const said = diagnose({ kind: "answered", status: 503 });

    expect(said.cause).toBe("error");
    expect(said.title).toContain("503");
    expect(said.action).toContain("daemon.log");
  });

  it("says how long it waited", () => {
    const said = diagnose({ kind: "timeout" });

    expect(said.cause).toBe("slow");
    expect(said.title).toContain("4 seconds");
  });
});

describe("diagnoseDaemon", () => {
  it("answers a sentence for the probe it got", async () => {
    vi.stubGlobal(
      "fetch",
      fetchSequence(async () => ({ status: 500 })),
    );

    await expect(diagnoseDaemon()).resolves.toMatchObject({ cause: "error" });
  });

  // The shell retries every two seconds and a probe against a dead port can outlast that, so a
  // retry must join the probe already running rather than start a second pair of requests.
  it("shares one probe between callers running at the same time", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async () => {
      await gate;
      return { status: 200 };
    });
    vi.stubGlobal("fetch", fetchMock);

    const both = Promise.all([diagnoseDaemon(), diagnoseDaemon()]);
    release();
    const [first, second] = await both;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});
