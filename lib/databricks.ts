import { getLakebaseConfig, getOAuthSecrets, type LakebaseConfig, type OAuthSecret } from "./config";
import { ExternalServiceError } from "./errors";
import { logStructured } from "./logging";

export type LakebaseCredential = {
  credentialSource: OAuthSecret["name"];
  expireTime?: string;
  token: string;
};

export async function generateLakebaseCredentialWithFallback(): Promise<LakebaseCredential> {
  const config = getLakebaseConfig();
  const secrets = getOAuthSecrets();
  let lastError: unknown;

  for (const secret of secrets) {
    try {
      const workspaceToken = await requestWorkspaceToken(config, secret);
      const credential = await requestDatabaseCredential(config, workspaceToken);
      return {
        credentialSource: secret.name,
        expireTime: credential.expire_time,
        token: credential.token
      };
    } catch (error) {
      lastError = error;
      logStructured("warn", "Databricks OAuth attempt failed; trying next configured secret.", {
        credential_source: secret.name,
        error: describeExternalError(error)
      });
    }
  }

  throw new ExternalServiceError(
    "Unable to mint a Lakebase database credential with either configured Databricks OAuth secret.",
    describeExternalError(lastError)
  );
}

async function requestWorkspaceToken(config: LakebaseConfig, secret: OAuthSecret) {
  const credentials = Buffer.from(`${config.databricksClientId}:${secret.value}`).toString("base64");
  const response = await fetch(`${config.databricksHost}/oidc/v1/token`, {
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "all-apis"
    }),
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new ExternalServiceError(
      `Databricks workspace token request failed with HTTP ${response.status}.`,
      `databricks_oauth_${response.status}`
    );
  }

  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new ExternalServiceError(
      "Databricks workspace token response did not contain an access token.",
      "databricks_oauth_missing_token"
    );
  }
  return body.access_token;
}

async function requestDatabaseCredential(config: LakebaseConfig, workspaceToken: string) {
  const response = await fetch(`${config.databricksHost}/api/2.0/postgres/credentials`, {
    body: JSON.stringify({
      endpoint: config.endpointPath
    }),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${workspaceToken}`,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new ExternalServiceError(
      `Lakebase database credential request failed with HTTP ${response.status}.`,
      `lakebase_credential_${response.status}`
    );
  }

  const body = (await response.json()) as { expire_time?: string; token?: string };
  if (!body.token) {
    throw new ExternalServiceError(
      "Lakebase database credential response did not contain a token.",
      "lakebase_credential_missing_token"
    );
  }
  return {
    expire_time: body.expire_time,
    token: body.token
  };
}

function describeExternalError(error: unknown) {
  if (error instanceof ExternalServiceError) {
    return error.causeCode ?? error.name;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return "unknown_error";
}
