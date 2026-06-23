import pg from "pg";

const { Client } = pg;

const REQUIRED_CONFIGURATION = [
  "DATABRICKS_HOST",
  "DATABRICKS_CLIENT_ID",
  "LAKEBASE_ENDPOINT_PATH",
  "LAKEBASE_PGHOST",
  "LAKEBASE_DATABASE"
];

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const missing = REQUIRED_CONFIGURATION.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.log(`Skipping Lakebase audit migration; missing ${missing.join(", ")}.`);
    return;
  }

  const config = lakebaseConfig();
  const secrets = oauthSecrets();
  let lastError = undefined;

  for (const secret of secrets) {
    try {
      const workspaceToken = await requestWorkspaceToken(config, secret);
      const databaseCredential = await requestDatabaseCredential(config, workspaceToken);
      await migrateAuditTable(config, databaseCredential.token);
      console.log(
        `Lakebase audit schema is ready in ${config.database} using ${secret.name}.`
      );
      return;
    } catch (error) {
      lastError = error;
      console.warn(
        `Lakebase audit migration attempt with ${secret.name} failed: ${describeError(error)}.`
      );
    }
  }

  throw new Error(
    `Unable to migrate Lakebase audit schema with any configured OAuth secret: ${describeError(lastError)}`
  );
}

async function migrateAuditTable(config, password) {
  const table = quotedIdentifier(config.auditTableName);
  const index = quotedIdentifier(`${config.auditTableName}_occurred_at_idx`);
  const client = new Client({
    connectionTimeoutMillis: Number(process.env.LAKEBASE_CONNECT_TIMEOUT_MS ?? "15000"),
    database: config.database,
    host: config.host,
    password,
    port: config.port,
    ssl: {
      rejectUnauthorized: config.sslRejectUnauthorized
    },
    user: config.user
  });

  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        event_id uuid PRIMARY KEY,
        occurred_at timestamptz NOT NULL,
        actor_user_id text NOT NULL,
        actor_display_name text NOT NULL,
        actor_roles text[] NOT NULL,
        action text NOT NULL,
        resource_type text NOT NULL,
        resource_id text NOT NULL,
        environment text NOT NULL,
        request_id text NOT NULL,
        source_ip_hash text,
        result text NOT NULL CHECK (result IN ('success', 'failure', 'denied', 'error')),
        metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS ${index}
      ON ${table} (occurred_at DESC)
    `);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function requestWorkspaceToken(config, secret) {
  const response = await fetch(`${config.databricksHost}/oidc/v1/token`, {
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "all-apis"
    }),
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.databricksClientId}:${secret.value}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Databricks workspace token request returned HTTP ${response.status}`);
  }

  const body = await response.json();
  if (!body.access_token) {
    throw new Error("Databricks workspace token response did not contain an access token.");
  }
  return body.access_token;
}

async function requestDatabaseCredential(config, workspaceToken) {
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
    throw new Error(`Lakebase database credential request returned HTTP ${response.status}`);
  }

  const body = await response.json();
  if (!body.token) {
    throw new Error("Lakebase database credential response did not contain a token.");
  }
  return body;
}

function lakebaseConfig() {
  const endpointPath = required("LAKEBASE_ENDPOINT_PATH");
  if (endpointPath.startsWith("postgresql://") || endpointPath.startsWith("postgres://")) {
    throw new Error(
      "LAKEBASE_ENDPOINT_PATH must be the Databricks endpoint resource path, not the PostgreSQL connection string."
    );
  }

  return {
    auditTableName: auditTableName(),
    database: required("LAKEBASE_DATABASE"),
    databricksClientId: required("DATABRICKS_CLIENT_ID"),
    databricksHost: normaliseHost(required("DATABRICKS_HOST")),
    endpointPath,
    host: required("LAKEBASE_PGHOST"),
    port: Number(process.env.LAKEBASE_PGPORT ?? "5432"),
    sslRejectUnauthorized:
      process.env.LAKEBASE_SSL_REJECT_UNAUTHORIZED?.toLowerCase() !== "false",
    user: process.env.LAKEBASE_USER?.trim() || required("DATABRICKS_CLIENT_ID")
  };
}

function oauthSecrets() {
  const secrets = [
    {
      name: "DATABRICKS_OAUTH_SECRET_1",
      value: process.env.DATABRICKS_OAUTH_SECRET_1?.trim()
    },
    {
      name: "DATABRICKS_OAUTH_SECRET_2",
      value: process.env.DATABRICKS_OAUTH_SECRET_2?.trim()
    }
  ].filter((secret) => secret.value);

  if (secrets.length === 0) {
    throw new Error("Missing Databricks OAuth secrets for Lakebase audit migration.");
  }
  return secrets;
}

function auditTableName() {
  const value = process.env.AUDIT_TABLE_NAME?.trim() || "app_audit_events";
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error("AUDIT_TABLE_NAME must use lowercase letters, numbers and underscores.");
  }
  return value;
}

function quotedIdentifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid PostgreSQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function normaliseHost(value) {
  return value.replace(/\/+$/, "");
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function describeError(error) {
  if (!error) {
    return "unknown error";
  }
  if (error instanceof Error) {
    const code = typeof error.code === "string" ? ` (${error.code})` : "";
    return `${error.message}${code}`;
  }
  return String(error);
}
