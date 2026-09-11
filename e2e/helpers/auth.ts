import axios, { type AxiosResponse } from "axios";
import type { E2eConfig } from "./env";

/** The subset of Salesforce's token response this suite uses. */
interface TokenResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
}

function isTokenResponse(value: unknown): value is TokenResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.access_token === "string" &&
    typeof candidate.instance_url === "string"
  );
}

/**
 * Salesforce's OAuth failure, as a single line.
 *
 * Reads only `error` and `error_description` from the response body. Those are
 * safe: they name the cause without echoing the request, whose form body and
 * headers carry the client secret.
 */
function describeOAuthFailure(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : String(error);
  }
  const status = error.response?.status;
  const data: unknown = error.response?.data;
  const prefix = status === undefined ? "" : `HTTP ${String(status)} — `;

  if (typeof data === "object" && data !== null) {
    const body = data as Record<string, unknown>;
    const code = typeof body.error === "string" ? body.error : undefined;
    const detail =
      typeof body.error_description === "string" ? body.error_description : undefined;
    if (code !== undefined || detail !== undefined) {
      return `${prefix}${[code, detail].filter((part) => part !== undefined).join(": ")}`;
    }
  }
  return `${prefix}${error.message}`;
}

/**
 * Map a Salesforce OAuth failure onto the setting that actually fixes it.
 *
 * Written after a live run produced two different `invalid_grant` messages in
 * succession, each needing a different Connected App change. A single generic
 * remedy sent the reader to the wrong screen for the second one, which is worse
 * than no remedy at all.
 */
function remedyFor(reason: string): string {
  const lower = reason.toLowerCase();
  const appPath = "  Setup -> App Manager -> your Connected App -> ";

  if (lower.includes("no client credentials user")) {
    return (
      `${appPath}Manage -> Edit Policies ->\n` +
      "  Client Credentials Flow -> assign a Run As user with API Enabled.\n"
    );
  }
  if (lower.includes("no valid scopes")) {
    return (
      `${appPath}Edit -> API (Enable OAuth Settings) ->\n` +
      '  Selected OAuth Scopes -> add "Manage user data via APIs (api)".\n' +
      "  The client-credentials flow issues a token with the app's scopes, and\n" +
      "  without `api` there is nothing the token may do.\n"
    );
  }
  if (lower.includes("inactive user")) {
    return "  The Run As user is inactive. Activate it, or choose another.\n";
  }
  if (lower.includes("unsupported_grant_type")) {
    return (
      `${appPath}Edit -> API (Enable OAuth Settings) ->\n` +
      '  tick "Enable Client Credentials Flow".\n'
    );
  }
  if (lower.includes("invalid_client")) {
    return (
      "  SF_CLIENT_ID or SF_CLIENT_SECRET does not match the Connected App.\n" +
      "  Re-read both from Manage Consumer Details.\n"
    );
  }
  return (
    `${appPath}confirm the client-credentials flow is\n` +
    "  enabled, has a Run As user, and has the `api` OAuth scope.\n"
  );
}

/**
 * Obtain an access token.
 *
 * `token` mode returns the one supplied. `client-credentials` mode mints a
 * fresh one, which is the mode to prefer for a long run: a Bulk job can take
 * minutes, and a hand-pasted token that expires mid-suite produces a failure
 * that looks like a library bug and is not.
 *
 * The library under test performs no authentication of its own — it accepts a
 * token — so this lives in the harness rather than in `src/`.
 */
export async function resolveAccessToken(config: E2eConfig): Promise<string> {
  if (config.mode === "token") {
    if (config.accessToken === undefined) {
      throw new Error("token mode requires SF_ACCESS_TOKEN");
    }
    return config.accessToken;
  }

  if (config.clientId === undefined || config.clientSecret === undefined) {
    throw new Error("client-credentials mode requires SF_CLIENT_ID and SF_CLIENT_SECRET");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  let response: AxiosResponse<unknown>;
  try {
    response = await axios.post<unknown>(
      `${config.loginUrl ?? config.instanceUrl}/services/oauth2/token`,
      body.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
  } catch (error) {
    // Never log the raw axios error: its config carries the client secret.
    // Salesforce's OAuth error body does not, and it is the only thing that
    // says *why* — so extract exactly those two fields and nothing else.
    const reason = describeOAuthFailure(error);

    // Fall back to a pasted token when one is available. Preferring the minted
    // token is right — it is fresh — but preferring it even when minting FAILS
    // would strand someone who supplied a perfectly good SF_ACCESS_TOKEN
    // alongside a Connected App that is not finished being configured.
    if (config.accessToken !== undefined) {
      console.warn(
        `[e2e] client-credentials failed (${reason}); falling back to SF_ACCESS_TOKEN.`,
      );
      return config.accessToken;
    }

    throw new Error(
      "Failed to mint an access token with the client-credentials flow.\n" +
        `  Salesforce said: ${reason}\n` +
        `  Token endpoint:  ${config.loginUrl ?? config.instanceUrl}/services/oauth2/token\n` +
        `${remedyFor(reason)}` +
        "  Or set SF_ACCESS_TOKEN in .env and re-run; it is used as a fallback\n" +
        "  when minting fails.",
    );
  }

  if (!isTokenResponse(response.data)) {
    throw new Error(
      "The token endpoint returned a response without access_token/instance_url.",
    );
  }
  return response.data.access_token;
}
