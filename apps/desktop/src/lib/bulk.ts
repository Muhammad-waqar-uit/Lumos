import type { VaultEntry } from "@lumos/shared";

/** What a bulk run did: how many writes landed, and why each of the others did not. */
export interface BulkSummary {
  done: number;
  failures: { key: string; reason: string }[];
}

/**
 * Run one write over many notes and answer what happened to each.
 *
 * `allSettled`, not `all`: one refusal - a name another note has taken, a folder that is not in
 * this vault - must not abandon the rest of the selection, and the daemon's own sentence is what
 * travels back for each failure, the same as a single-note operation. Nothing else ever throws,
 * so the caller can always report a summary.
 */
export async function runBulk(
  targets: VaultEntry[],
  write: (entry: VaultEntry) => Promise<unknown>,
): Promise<BulkSummary> {
  const settled = await Promise.allSettled(targets.map((entry) => write(entry)));
  const failures = settled.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          {
            key: `${targets[index].folder}/${targets[index].name}`,
            reason: result.reason instanceof Error ? result.reason.message : "unknown error",
          },
        ]
      : [],
  );
  return { done: settled.length - failures.length, failures };
}

/**
 * The one sentence the status bar shows for a run: what landed, and - when something did not -
 * the first refusal in the daemon's own words. One failure is a sentence, not a list.
 */
export function bulkNotice(action: string, summary: BulkSummary): string {
  const total = summary.done + summary.failures.length;
  if (summary.failures.length === 0) {
    return `${action} ${summary.done} ${summary.done === 1 ? "note" : "notes"}.`;
  }
  const first = summary.failures[0];
  const landed = summary.done === 0 ? "nothing" : `${summary.done} of ${total}`;
  return `${action} ${landed}; "${first.key.split("/").pop()}": ${first.reason}`;
}
