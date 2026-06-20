import { readFileSync } from "node:fs";

const contractPath = "app.yml";
const text = readFileSync(contractPath, "utf8");
const failures = [];

const appName = scalar("app", "name");
const environment = scalar("hosting", "environment");
const runtimeFramework = scalar("runtime", "framework");
const nodeVersion = scalar("runtime", "node_version");
const healthPath = scalar("runtime", "health_path");
const containerMode = scalar("runtime", "container_app_mode");
const azureDeployment = scalar("hosting", "azure_deployment");
const resourceGroup = scalar("hosting", "resource_group_name");
const containerApp = scalar("hosting", "container_app_name");
const managedEnvironment = scalar("hosting", "container_apps_managed_environment_name");
const managedEnvironmentModel = scalar("hosting", "container_apps_managed_environment_model");
const databaseProvider = scalar("database", "provider");
const databaseName = scalar("database", "database_name");
const databaseModel = scalar("database", "environment_database_model");
const runtimeAuthentication = scalar("database", "runtime_authentication");
const tokenRotationRequired = scalar("database", "token_rotation_required");
const lakebaseAuditRequired = scalar("audit", "lakebase_app_audit_required");
const logAnalyticsRequired = scalar("audit", "log_analytics_redundancy_required");
const defaultBranch = scalar("deployment", "default_branch");

required("app.name", appName);
required("hosting.environment", environment);

if (appName && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(appName)) {
  fail("app.name must be a lowercase DNS-style slug using hyphens, not underscores.");
}

if (environment && !/^(dev|prod)$/.test(environment)) {
  fail("hosting.environment must be dev or prod for this template.");
}

expect("runtime.framework", runtimeFramework, "nextjs");
expect("runtime.node_version", nodeVersion, "22");
expect("runtime.container_app_mode", containerMode, "combined");
expect("hosting.azure_deployment", azureDeployment, "true");
expect("hosting.container_apps_managed_environment_model", managedEnvironmentModel, "per_app_environment");
expect("database.provider", databaseProvider, "databricks_lakebase");
expect("database.environment_database_model", databaseModel, "database_per_app_environment");
expect("database.runtime_authentication", runtimeAuthentication, "oauth_database_credentials");
expect("database.token_rotation_required", tokenRotationRequired, "true");
expect("audit.lakebase_app_audit_required", lakebaseAuditRequired, "true");
expect("audit.log_analytics_redundancy_required", logAnalyticsRequired, "true");
expect("deployment.default_branch", defaultBranch, "main");

if (healthPath && !healthPath.startsWith("/")) {
  fail("runtime.health_path must start with '/'.");
}

if (appName && environment) {
  expect("hosting.resource_group_name", resourceGroup, `rg-app-${appName}-${environment}`);
  expect("hosting.container_app_name", containerApp, `ca-${appName}-${environment}`);
  expect(
    "hosting.container_apps_managed_environment_name",
    managedEnvironment,
    `cae-${appName}-${environment}`
  );
  expect("database.database_name", databaseName, `db-app-${appName}-${environment}`);
}

validateBranchEnvironmentMap();
validateAppRoles();
validateRequiredVariables();
validateOAuthFallbackOrder();

if (failures.length > 0) {
  console.error("app.yml contract validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("app.yml contract validation passed.");

function validateAppRoles() {
  const roles = mapList("identity", "app_roles");
  const expected = new Map([
    ["App.Admin", `app-${appName}-${environment}-admin`],
    ["App.Write", `app-${appName}-${environment}-write`],
    ["App.Read", `app-${appName}-${environment}-read`]
  ]);

  for (const [roleName, groupName] of expected) {
    const role = roles.find((item) => item.name === roleName);
    if (!role) {
      fail(`identity.app_roles must include ${roleName}.`);
      continue;
    }
    if (role.group_name !== groupName) {
      fail(`identity.app_roles ${roleName} group_name must be ${groupName}.`);
    }
  }
}

function validateBranchEnvironmentMap() {
  const block = nestedBlock("deployment", "branch_environment_map");
  if (!block) {
    fail("deployment.branch_environment_map is required.");
    return;
  }

  const values = Object.fromEntries(
    block
      .split(/\r?\n/)
      .map((line) => line.match(/^\s{4}([a-z0-9_-]+):\s*([a-z0-9_-]+)\s*$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]])
  );

  if (values.dev !== "dev") {
    fail("deployment.branch_environment_map.dev must map to dev.");
  }
  if (values.main !== "prod") {
    fail("deployment.branch_environment_map.main must map to prod.");
  }
}

function validateRequiredVariables() {
  const variables = list("deployment", "required_github_environment_variables");
  const expected = [
    "AZURE_LOCATION",
    "AZURE_CLIENT_ID",
    "AZURE_TENANT_ID",
    "AZURE_SUBSCRIPTION_ID",
    "DATABRICKS_HOST",
    "DATABRICKS_CLIENT_ID",
    "LAKEBASE_ENDPOINT_PATH",
    "LAKEBASE_PGHOST",
    "LAKEBASE_PGPORT"
  ];

  for (const name of expected) {
    if (!variables.includes(name)) {
      fail(`deployment.required_github_environment_variables must include ${name}.`);
    }
  }

  for (const derived of ["LAKEBASE_DATABASE", "LAKEBASE_USER"]) {
    if (variables.includes(derived)) {
      fail(`${derived} must not be listed as required; the workflow derives it.`);
    }
  }
}

function validateOAuthFallbackOrder() {
  const fallbackOrder = list("database", "oauth_secret_fallback_order");
  if (fallbackOrder[0] !== "DATABRICKS_OAUTH_SECRET_1") {
    fail("database.oauth_secret_fallback_order must try DATABRICKS_OAUTH_SECRET_1 first.");
  }
  if (fallbackOrder[1] !== "DATABRICKS_OAUTH_SECRET_2") {
    fail("database.oauth_secret_fallback_order must try DATABRICKS_OAUTH_SECRET_2 second.");
  }
}

function scalar(sectionName, key) {
  const block = section(sectionName);
  const match = block.match(new RegExp(`^  ${escapeRegex(key)}:\\s*(.*?)\\s*$`, "m"));
  if (!match) {
    return undefined;
  }
  return unquote(match[1]);
}

function list(sectionName, key) {
  const block = nestedBlock(sectionName, key);
  if (!block) {
    return [];
  }
  return block
    .split(/\r?\n/)
    .map((line) => line.match(/^\s{4}-\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((match) => unquote(match[1]));
}

function mapList(sectionName, key) {
  const block = nestedBlock(sectionName, key);
  if (!block) {
    return [];
  }

  const items = [];
  let current = undefined;
  for (const line of block.split(/\r?\n/)) {
    const first = line.match(/^\s{4}-\s*([a-z0-9_]+):\s*(.*?)\s*$/i);
    if (first) {
      current = { [first[1]]: unquote(first[2]) };
      items.push(current);
      continue;
    }

    const child = line.match(/^\s{6}([a-z0-9_]+):\s*(.*?)\s*$/i);
    if (child && current) {
      current[child[1]] = unquote(child[2]);
    }
  }
  return items;
}

function nestedBlock(sectionName, key) {
  const block = section(sectionName);
  const lines = block.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${key}:`);
  if (start === -1) {
    return "";
  }

  const children = [];
  for (const line of lines.slice(start + 1)) {
    if (/^  [a-z0-9_]+:/i.test(line)) {
      break;
    }
    if (line.trim().length > 0) {
      children.push(line);
    }
  }
  return children.join("\n");
}

function section(name) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${name}:`);
  if (start === -1) {
    return "";
  }

  const children = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) {
      break;
    }
    children.push(line);
  }
  return children.join("\n");
}

function expect(path, actual, expected) {
  if (actual !== expected) {
    fail(`${path} must be ${expected}; found ${actual ?? "missing"}.`);
  }
}

function required(path, value) {
  if (!value) {
    fail(`${path} is required.`);
  }
}

function fail(message) {
  failures.push(message);
}

function unquote(value) {
  return value.replace(/^["']|["']$/g, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
