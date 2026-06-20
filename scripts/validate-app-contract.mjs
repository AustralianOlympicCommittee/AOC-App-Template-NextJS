import { loadAppContract } from "./app-contract.mjs";

const contract = loadAppContract("app.yml");
const failures = [];

const appName = contract.scalar("app", "name");
const environment = contract.scalar("hosting", "environment");
const runtimeFramework = contract.scalar("runtime", "framework");
const nodeVersion = contract.scalar("runtime", "node_version");
const healthPath = contract.scalar("runtime", "health_path");
const containerMode = contract.scalar("runtime", "container_app_mode");
const azureDeployment = contract.scalar("hosting", "azure_deployment");
const resourceGroup = contract.scalar("hosting", "resource_group_name");
const containerApp = contract.scalar("hosting", "container_app_name");
const managedEnvironment = contract.scalar("hosting", "container_apps_managed_environment_name");
const managedEnvironmentModel = contract.scalar("hosting", "container_apps_managed_environment_model");
const databaseProvider = contract.scalar("database", "provider");
const databaseName = contract.scalar("database", "database_name");
const databaseModel = contract.scalar("database", "environment_database_model");
const runtimeAuthentication = contract.scalar("database", "runtime_authentication");
const tokenRotationRequired = contract.scalar("database", "token_rotation_required");
const migrationCommand = contract.scalar("database", "migration_command");
const lakebaseAuditRequired = contract.scalar("audit", "lakebase_app_audit_required");
const logAnalyticsRequired = contract.scalar("audit", "log_analytics_redundancy_required");
const auditTableName = contract.scalar("audit", "audit_table_name");
const defaultBranch = contract.scalar("deployment", "default_branch");

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
expect("database.migration_command", migrationCommand, "npm run migrate:audit");
expect("audit.lakebase_app_audit_required", lakebaseAuditRequired, "true");
expect("audit.log_analytics_redundancy_required", logAnalyticsRequired, "true");
expect("deployment.default_branch", defaultBranch, "main");

if (healthPath && !healthPath.startsWith("/")) {
  fail("runtime.health_path must start with '/'.");
}

if (auditTableName && !/^[a-z][a-z0-9_]*$/.test(auditTableName)) {
  fail("audit.audit_table_name must use lowercase letters, numbers and underscores.");
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
  const roles = contract.mapList("identity", "app_roles");
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
  const values = contract.map("deployment", "branch_environment_map");
  if (Object.keys(values).length === 0) {
    fail("deployment.branch_environment_map is required.");
    return;
  }

  if (values.dev !== "dev") {
    fail("deployment.branch_environment_map.dev must map to dev.");
  }
  if (values.main !== "prod") {
    fail("deployment.branch_environment_map.main must map to prod.");
  }
}

function validateRequiredVariables() {
  const variables = contract.list("deployment", "required_github_environment_variables");
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
  const fallbackOrder = contract.list("database", "oauth_secret_fallback_order");
  if (fallbackOrder[0] !== "DATABRICKS_OAUTH_SECRET_1") {
    fail("database.oauth_secret_fallback_order must try DATABRICKS_OAUTH_SECRET_1 first.");
  }
  if (fallbackOrder[1] !== "DATABRICKS_OAUTH_SECRET_2") {
    fail("database.oauth_secret_fallback_order must try DATABRICKS_OAUTH_SECRET_2 second.");
  }
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
