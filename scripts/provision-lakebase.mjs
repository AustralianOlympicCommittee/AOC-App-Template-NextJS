const REQUIRED_CONFIGURATION = [
  "DATABRICKS_HOST",
  "DATABRICKS_CLIENT_ID",
  "LAKEBASE_ENDPOINT_PATH"
];

let branchPath = "";
let clientId = "";
let databaseName = "";
let databaseResourceName = "";
let host = "";
let roleName = "";

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const missing = REQUIRED_CONFIGURATION.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.log(`Skipping Lakebase role provisioning; missing ${missing.join(", ")}.`);
    return;
  }

  host = normaliseHost(required("DATABRICKS_HOST"));
  clientId = required("DATABRICKS_CLIENT_ID");
  branchPath = branchFromEndpoint(required("LAKEBASE_ENDPOINT_PATH"));
  roleName = `${branchPath}/roles/${clientId}`;
  databaseName = required("LAKEBASE_DATABASE");
  databaseResourceName = `${branchPath}/databases/${databaseName}`;

  const token = await requestWorkspaceToken();
  await ensureServicePrincipalRole(token);
  await ensureAppDatabase(token);
}

async function ensureServicePrincipalRole(token) {
  const existingRole = await databricksApi(token, "GET", `/api/2.0/postgres/${roleName}`, {
    acceptedStatuses: [200, 404]
  });
  if (existingRole.status === 200) {
    assertServicePrincipalRole(existingRole.body);
    console.log(`Lakebase service-principal role already exists: ${roleName}`);
    return;
  }

  console.log(`Creating Lakebase service-principal role: ${roleName}`);
  const created = await databricksApi(
    token,
    "POST",
    `/api/2.0/postgres/${branchPath}/roles?role_id=${encodeURIComponent(clientId)}`,
    {
      acceptedStatuses: [200, 201, 202],
      body: {
        parent: branchPath,
        role_id: clientId,
        spec: {
          auth_method: "LAKEBASE_OAUTH_V1",
          identity_type: "SERVICE_PRINCIPAL",
          postgres_role: clientId
        }
      }
    }
  );

  await waitForOperation(token, created.body);

  const verifiedRole = await databricksApi(token, "GET", `/api/2.0/postgres/${roleName}`, {
    acceptedStatuses: [200]
  });
  assertServicePrincipalRole(verifiedRole.body);
  console.log(`Lakebase service-principal role is ready: ${roleName}`);
}

async function ensureAppDatabase(token) {
  const existingDatabase = await databricksApi(
    token,
    "GET",
    `/api/2.0/postgres/${databaseResourceName}`,
    {
      acceptedStatuses: [200, 404]
    }
  );

  if (existingDatabase.status === 200) {
    assertAppDatabase(existingDatabase.body);
    console.log(`Lakebase app database already exists: ${databaseResourceName}`);
    return;
  }

  console.log(`Creating Lakebase app database: ${databaseResourceName}`);
  const created = await databricksApi(
    token,
    "POST",
    `/api/2.0/postgres/${branchPath}/databases?database_id=${encodeURIComponent(databaseName)}`,
    {
      acceptedStatuses: [200, 201, 202],
      body: {
        database_id: databaseName,
        parent: branchPath,
        spec: {
          postgres_database: databaseName,
          role: roleName
        }
      }
    }
  );

  await waitForOperation(token, created.body);

  const verifiedDatabase = await databricksApi(
    token,
    "GET",
    `/api/2.0/postgres/${databaseResourceName}`,
    {
      acceptedStatuses: [200]
    }
  );
  assertAppDatabase(verifiedDatabase.body);
  console.log(`Lakebase app database is ready: ${databaseResourceName}`);
}

async function requestWorkspaceToken() {
  const secrets = [
    ["DATABRICKS_OAUTH_SECRET_1", process.env.DATABRICKS_OAUTH_SECRET_1],
    ["DATABRICKS_OAUTH_SECRET_2", process.env.DATABRICKS_OAUTH_SECRET_2]
  ].filter(([, value]) => Boolean(value?.trim()));

  if (secrets.length === 0) {
    throw new Error("Missing Databricks OAuth secrets for Lakebase role provisioning.");
  }

  for (const [name, secret] of secrets) {
    const response = await fetch(`${host}/oidc/v1/token`, {
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "all-apis"
      }),
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    });

    if (response.ok) {
      const body = await response.json();
      if (typeof body.access_token === "string" && body.access_token.length > 0) {
        return body.access_token;
      }
      throw new Error(`Databricks OAuth token response from ${name} did not include an access token.`);
    }

    console.warn(`Databricks OAuth request with ${name} failed with HTTP ${response.status}.`);
  }

  throw new Error("Unable to obtain a Databricks workspace token with either configured OAuth secret.");
}

async function waitForOperation(token, operation) {
  if (!operation?.name) {
    return;
  }

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const current = await databricksApi(token, "GET", `/api/2.0/postgres/${operation.name}`, {
      acceptedStatuses: [200]
    });

    if (current.body?.done) {
      if (current.body.error) {
        throw new Error(`Lakebase role operation failed: ${summariseDatabricksError(current.body.error)}`);
      }
      return;
    }

    await delay(5000);
  }

  throw new Error(`Timed out waiting for Lakebase role operation to complete: ${operation.name}`);
}

async function databricksApi(token, method, path, options = {}) {
  const response = await fetch(`${host}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    method
  });

  const body = await parseJson(response);
  const acceptedStatuses = options.acceptedStatuses ?? [200];
  if (!acceptedStatuses.includes(response.status)) {
    throw new Error(
      `Databricks ${method} ${path} failed with HTTP ${response.status}: ${summariseDatabricksError(body)}`
    );
  }

  return {
    body,
    status: response.status
  };
}

function assertServicePrincipalRole(role) {
  const details = role?.status ?? role?.spec ?? {};
  if (
    details.auth_method !== "LAKEBASE_OAUTH_V1" ||
    details.identity_type !== "SERVICE_PRINCIPAL" ||
    details.postgres_role !== clientId
  ) {
    throw new Error(
      `Lakebase role ${roleName} exists but is not mapped to this service principal with LAKEBASE_OAUTH_V1.`
    );
  }
}

function assertAppDatabase(database) {
  const details = database?.status ?? database?.spec ?? {};
  if (details.postgres_database !== databaseName || details.role !== roleName) {
    throw new Error(
      `Lakebase database ${databaseResourceName} exists but is not owned by the app service-principal role.`
    );
  }
}

function branchFromEndpoint(value) {
  const branch = value.replace(/\/endpoints\/[^/]+$/, "");
  if (branch === value) {
    throw new Error(
      "LAKEBASE_ENDPOINT_PATH must use projects/{project-id}/branches/{branch-id}/endpoints/{endpoint-id}."
    );
  }
  return branch;
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

async function parseJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function summariseDatabricksError(body) {
  if (!body || typeof body !== "object") {
    return "no response body";
  }

  const code = body.error_code ?? body.errorCode ?? body.code ?? "unknown";
  const message = body.message ?? body.error?.message ?? "no message";
  return `${code}: ${message}`;
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
