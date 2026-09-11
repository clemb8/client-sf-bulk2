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
    throw new Error(
      "Failed to mint an access token with the client-credentials flow. " +
        "Check SF_CLIENT_ID, SF_CLIENT_SECRET and SF_LOGIN_URL, and confirm the " +
        "connected app has the client-credentials flow enabled with a run-as user. " +
        `Underlying message: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!isTokenResponse(response.data)) {
    throw new Error(
      "The token endpoint returned a response without access_token/instance_url.",
    );
  }
  return response.data.access_token;
}
