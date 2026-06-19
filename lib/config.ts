import { ConfigurationError } from "./errors";

export type LakebaseConfig = {
  appEnvironment: string;
  appName: string;
  databricksClientId: string;
  databricksHost: string;
  database: string;
  endpointPath: string;
  host: string;
  port: number;
  sslRejectUnauthorized: boolean;
  user: string;
};

export type OAuthSecret = {
  name: "DATABRICKS_OAUTH_SECRET_1" | "DATABRICKS_OAUTH_SECRET_2";
  value: string;
};

export function getRuntimeSummary() {
  return {
    app_environment: process.env.APP_ENVIRONMENT ?? "dev",
    app_name: process.env.APP_NAME ?? "aoc-app-template-nextjs",
    lakebase_configured: hasAll([
      "DATABRICKS_HOST",
      "DATABRICKS_CLIENT_ID",
      "DATABRICKS_OAUTH_SECRET_1",
      "DATABRICKS_OAUTH_SECRET_2",
      "LAKEBASE_ENDPOINT_PATH",
      "LAKEBASE_PGHOST",
      "LAKEBASE_DATABASE"
    ]),
    node_env: process.env.NODE_ENV ?? "unknown"
  };
}

export function getLakebaseConfig(): LakebaseConfig {
  const databricksClientId = required("DATABRICKS_CLIENT_ID");
  const endpointPath = required("LAKEBASE_ENDPOINT_PATH");
  if (endpointPath.startsWith("postgresql://") || endpointPath.startsWith("postgres://")) {
    throw new ConfigurationError(
      "LAKEBASE_ENDPOINT_PATH must be the Databricks endpoint resource path, not the PostgreSQL connection string. Expected format: projects/{project-id}/branches/{branch-id}/endpoints/{endpoint-id}."
    );
  }

  return {
    appEnvironment: process.env.APP_ENVIRONMENT ?? "dev",
    appName: process.env.APP_NAME ?? "aoc-app-template-nextjs",
    databricksClientId,
    databricksHost: normaliseHost(required("DATABRICKS_HOST")),
    database: required("LAKEBASE_DATABASE"),
    endpointPath,
    host: required("LAKEBASE_PGHOST"),
    port: Number(process.env.LAKEBASE_PGPORT ?? "5432"),
    sslRejectUnauthorized:
      process.env.LAKEBASE_SSL_REJECT_UNAUTHORIZED?.toLowerCase() !== "false",
    user: optional("LAKEBASE_USER") ?? databricksClientId
  };
}

export function getOAuthSecrets(): OAuthSecret[] {
  return [
    {
      name: "DATABRICKS_OAUTH_SECRET_1",
      value: required("DATABRICKS_OAUTH_SECRET_1")
    },
    {
      name: "DATABRICKS_OAUTH_SECRET_2",
      value: required("DATABRICKS_OAUTH_SECRET_2")
    }
  ];
}

function hasAll(names: string[]) {
  return names.every((name) => Boolean(process.env[name]?.trim()));
}

function normaliseHost(value: string) {
  return value.replace(/\/+$/, "");
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConfigurationError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}
