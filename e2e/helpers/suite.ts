import { describe } from "vitest";
import type BulkAPI from "../../src/BulkAPI";
import { resolveAccessToken } from "./auth";
import { type E2eConfig, isSkip, resolveE2eConfig } from "./env";
import { createClient, TempFiles, runTag } from "./org";

/**
 * Resolved once per file. A malformed configuration throws here, loudly and at
 * import time, because a half-filled `.env` is a mistake. An empty one returns
 * a skip, because having no org is a legitimate state for a contributor.
 */
const resolved = resolveE2eConfig();

export const e2eSkipReason = isSkip(resolved) ? resolved.reason : null;

/**
 * `describe` that becomes `describe.skip` when no org is configured, so the
 * suite reports skipped rather than failing on a machine with no credentials.
 *
 * A wrapper rather than `const describeE2e = cond ? describe.skip : describe`:
 * the conditional's inferred type references vitest internals that cannot be
 * named across a module boundary, which `tsc --declaration` rejects.
 */
export function describeE2e(name: string, fn: () => void): void {
  if (isSkip(resolved)) {
    describe.skip(name, fn);
  } else {
    describe(name, fn);
  }
}

export function e2eConfig(): E2eConfig {
  if (isSkip(resolved)) {
    throw new Error("e2eConfig() called while the suite is skipped");
  }
  return resolved;
}

export interface E2eContext {
  config: E2eConfig;
  client: BulkAPI;
  files: TempFiles;
  tag: string;
}

/**
 * Build a context for one test file: a fresh token, a client, a scratch
 * directory and a run tag. Call from `beforeAll`.
 */
export async function createContext(): Promise<E2eContext> {
  const config = e2eConfig();
  const token = await resolveAccessToken(config);
  return {
    config,
    client: createClient(config, token),
    files: new TempFiles(),
    tag: runTag(),
  };
}

export function disposeContext(context: E2eContext | undefined): void {
  context?.files.dispose();
}
