import { Client } from "pg";
import { getLakebaseConfig } from "./config";
import { generateLakebaseCredentialWithFallback, type LakebaseCredential } from "./databricks";
import { ExternalServiceError } from "./errors";

export type LakebaseSession<T> = {
  credential: LakebaseCredential;
  result: T;
};

export async function withLakebaseClient<T>(
  work: (client: Client) => Promise<T>
): Promise<LakebaseSession<T>> {
  const config = getLakebaseConfig();
  const credential = await generateLakebaseCredentialWithFallback();
  const client = new Client({
    connectionTimeoutMillis: Number(process.env.LAKEBASE_CONNECT_TIMEOUT_MS ?? "15000"),
    database: config.database,
    host: config.host,
    password: credential.token,
    port: config.port,
    ssl: {
      rejectUnauthorized: config.sslRejectUnauthorized
    },
    user: config.user
  });

  await connectToLakebase(client);
  try {
    return {
      credential,
      result: await work(client)
    };
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      throw error;
    }
    throw describePostgresError("query", error);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function connectToLakebase(client: Client) {
  try {
    await client.connect();
  } catch (error) {
    throw describePostgresError("connect", error);
  }
}

function describePostgresError(stage: "connect" | "query", error: unknown) {
  const pgCode = postgresErrorCode(error);
  const tlsCode = tlsErrorCode(error);
  const code = tlsCode ?? postgresStageCode(stage, pgCode);
  const message =
    stage === "connect"
      ? "Lakebase PostgreSQL connection failed."
      : "Lakebase audit table write failed.";

  return new ExternalServiceError(message, code);
}

function postgresStageCode(stage: "connect" | "query", pgCode?: string) {
  if (!pgCode) {
    return `lakebase_postgres_${stage}_error`;
  }
  if (pgCode === "28P01" || pgCode === "28000") {
    return "lakebase_postgres_authentication_failed";
  }
  if (pgCode === "3D000") {
    return "lakebase_database_not_found";
  }
  if (pgCode === "42501") {
    return "lakebase_postgres_permission_denied";
  }
  if (pgCode === "42P01") {
    return "lakebase_audit_table_not_found";
  }
  if (pgCode === "42P07") {
    return "lakebase_audit_table_conflict";
  }
  return `lakebase_postgres_${stage}_${pgCode}`;
}

function postgresErrorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && code.length > 0 ? code : undefined;
  }
  return undefined;
}

function tlsErrorCode(error: unknown) {
  if (!(error instanceof Error)) {
    return undefined;
  }
  const message = error.message.toLowerCase();
  if (message.includes("certificate") || message.includes("ssl") || message.includes("tls")) {
    return "lakebase_tls_error";
  }
  return undefined;
}
