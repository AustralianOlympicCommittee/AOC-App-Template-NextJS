import { Client } from "pg";
import { getLakebaseConfig } from "./config";
import { generateLakebaseCredentialWithFallback, type LakebaseCredential } from "./databricks";

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

  await client.connect();
  try {
    return {
      credential,
      result: await work(client)
    };
  } finally {
    await client.end();
  }
}
