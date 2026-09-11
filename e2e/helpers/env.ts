/**
 * Environment resolution for the end-to-end suite.
 *
 * Two rules shape this file:
 *
 * 1. **Absent credentials skip, they do not fail.** Someone cloning the repo
 *    with no Salesforce org must still get a green `npm test` and a green
 *    `npm run test:e2e`. Only a *partial* or *malformed* configuration fails,
 *    because that is a mistake rather than a choice.
 * 2. **Nothing is read at import time.** Reading env inside the resolver keeps
 *    the module importable by the linter and the type checker without a live
 *    configuration.
 */

/** How the suite authenticates. */
export type AuthMode = "token" | "client-credentials";

export interface E2eConfig {
  mode: AuthMode;
  instanceUrl: string;
  apiVersion: string;
  /** Present only in `token` mode. */
  accessToken?: string;
  /** Present only in `client-credentials` mode. */
  clientId?: string;
  clientSecret?: string;
  loginUrl?: string;
  /** sObject the ingest tests write to. Must be creatable and deletable. */
  object: string;
  /** Field used as the record label. */
  labelField: string;
  /** Records created per ingest test. Kept small on purpose. */
  recordCount: number;
  /** Poll interval handed to waitQueryEnd/waitJobEnd, in milliseconds. */
  pollDelayMs: number;
  /** Per-test timeout, in milliseconds. Bulk jobs are not fast. */
  timeoutMs: number;
  /** Whether the suite may run against a host that does not look like a sandbox. */
  allowNonSandbox: boolean;
  /** Whether created records are deleted afterwards. */
  cleanup: boolean;
}

export interface E2eSkip {
  skip: true;
  reason: string;
}

function read(name: string): string | undefined {
  const raw = process.env[name];
  const trimmed = raw?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function readInt(name: string, fallback: number): number {
  const raw = read(name);
  if (raw === undefined) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, received "${raw}".`);
  }
  return value;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = read(name)?.toLowerCase();
  if (raw === undefined) return fallback;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  throw new Error(`${name} must be true or false, received "${raw}".`);
}

/**
 * A host that is not obviously a sandbox, scratch org or developer edition.
 * Deliberately conservative: it errs toward treating a host as production,
 * because the ingest tests create and delete records.
 */
export function looksLikeProduction(instanceUrl: string): boolean {
  const host = (() => {
    try {
      return new URL(instanceUrl).hostname.toLowerCase();
    } catch {
      throw new Error(`SF_INSTANCE_URL is not a valid URL: "${instanceUrl}".`);
    }
  })();
  const nonProductionMarkers = [
    "--",              // sandbox My Domain, e.g. acme--dev.sandbox.my.salesforce.com
    ".sandbox.",
    ".scratch.",
    ".develop.",
    ".cs",             // legacy sandbox instance
    "-dev-ed.",        // developer edition, including Trailhead playgrounds
    ".trailblaze.",    // Trailhead playground
    "localhost",
  ];
  return !nonProductionMarkers.some((marker) => host.includes(marker));
}

/**
 * Reject the Lightning UI domain.
 *
 * `*.lightning.force.com` serves the web UI; the REST and Bulk APIs live on the
 * org's `*.my.salesforce.com` domain. Pointing a client at the former produces
 * redirects and HTML error pages rather than a clean failure, which is a
 * miserable thing to debug — so it is caught here with the correction spelled
 * out.
 */
export function assertApiHost(instanceUrl: string): void {
  const host = new URL(instanceUrl).hostname.toLowerCase();
  if (!host.endsWith(".lightning.force.com")) return;
  const suggestion = `https://${host.replace(/\.lightning\.force\.com$/, ".my.salesforce.com")}`;
  throw new Error(
    `SF_INSTANCE_URL points at the Lightning UI domain ("${host}"). The REST and ` +
      "Bulk APIs are served from the org's My Domain instead, and a client aimed " +
      "at the UI host gets redirects and HTML rather than JSON. Use:\n\n" +
      `  SF_INSTANCE_URL=${suggestion}\n\n` +
      "Confirm the exact value with `sf org display --target-org <alias>` and read " +
      'it from the "Instance Url" field.',
  );
}

/**
 * Resolve the configuration, or explain why the suite is skipped.
 *
 * Throws only when the configuration is present but wrong — a half-filled
 * `.env` is a mistake worth surfacing loudly, an empty one is not.
 */
export function resolveE2eConfig(): E2eConfig | E2eSkip {
  const instanceUrl = read("SF_INSTANCE_URL");
  const accessToken = read("SF_ACCESS_TOKEN");
  const clientId = read("SF_CLIENT_ID");
  const clientSecret = read("SF_CLIENT_SECRET");

  const anythingSet =
    instanceUrl !== undefined ||
    accessToken !== undefined ||
    clientId !== undefined ||
    clientSecret !== undefined;

  if (!anythingSet) {
    return {
      skip: true,
      reason:
        "No Salesforce credentials in the environment. Copy .env.example to .env " +
        "and fill it in to run the end-to-end suite. See e2e/README.md.",
    };
  }

  if (instanceUrl === undefined) {
    throw new Error(
      "SF_INSTANCE_URL is required once any other SF_* variable is set. " +
        'Example: "https://my-org--dev.sandbox.my.salesforce.com".',
    );
  }

  const hasClientCredentials = clientId !== undefined && clientSecret !== undefined;
  if (clientId !== undefined && clientSecret === undefined) {
    throw new Error("SF_CLIENT_ID is set but SF_CLIENT_SECRET is not.");
  }
  if (clientSecret !== undefined && clientId === undefined) {
    throw new Error("SF_CLIENT_SECRET is set but SF_CLIENT_ID is not.");
  }
  if (accessToken === undefined && !hasClientCredentials) {
    throw new Error(
      "Provide either SF_ACCESS_TOKEN, or SF_CLIENT_ID and SF_CLIENT_SECRET " +
        "for the OAuth client-credentials flow.",
    );
  }

  assertApiHost(instanceUrl);

  const allowNonSandbox = readBool("SF_E2E_ALLOW_NON_SANDBOX", false);
  if (!allowNonSandbox && looksLikeProduction(instanceUrl)) {
    throw new Error(
      `Refusing to run against "${instanceUrl}": the host does not look like a ` +
        "sandbox, scratch org or developer edition, and the ingest tests create " +
        "and delete records. Point SF_INSTANCE_URL at a non-production org, or " +
        "set SF_E2E_ALLOW_NON_SANDBOX=true if you are certain.",
    );
  }

  // client-credentials wins when both are present: a minted token is fresh,
  // where a pasted one may already have expired.
  const mode: AuthMode = hasClientCredentials ? "client-credentials" : "token";

  return {
    mode,
    instanceUrl,
    apiVersion: read("SF_API_VERSION") ?? "64.0",
    ...(accessToken === undefined ? {} : { accessToken }),
    ...(hasClientCredentials ? { clientId, clientSecret } : {}),
    loginUrl: read("SF_LOGIN_URL") ?? instanceUrl,
    object: read("SF_E2E_OBJECT") ?? "Account",
    labelField: read("SF_E2E_LABEL_FIELD") ?? "Name",
    recordCount: readInt("SF_E2E_RECORD_COUNT", 3),
    pollDelayMs: readInt("SF_E2E_POLL_DELAY_MS", 3000),
    timeoutMs: readInt("SF_E2E_TIMEOUT_MS", 180000),
    allowNonSandbox,
    cleanup: readBool("SF_E2E_CLEANUP", true),
  };
}

export function isSkip(value: E2eConfig | E2eSkip): value is E2eSkip {
  return "skip" in value;
}
