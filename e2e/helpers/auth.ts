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
        "  Fix either way:\n" +
        "    (a) Setup -> App Manager -> your app -> Manage -> Edit Policies ->\n" +
        "        Client Credentials Flow -> assign a Run As user. Salesforce\n" +
        "        rejects the flow without one, which is what this error means.\n" +
        "    (b) Or set SF_ACCESS_TOKEN in .env and re-run; it is used as a\n" +
        "        fallback when minting fails.",
    );
  }

  if (!isTokenResponse(response.data)) {
    throw new Error(
      "The token endpoint returned a response without access_token/instance_url.",
    );
  }
  return response.data.access_token;
}
