import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function loadAppContract(contractPath = "app.yml") {
  const text = readFileSync(contractPath, "utf8");

  return {
    contractPath,
    list,
    map,
    mapList,
    nestedBlock,
    scalar,
    section,
    text
  };

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

  function map(sectionName, key) {
    const block = nestedBlock(sectionName, key);
    if (!block) {
      return {};
    }
    return Object.fromEntries(
      block
        .split(/\r?\n/)
        .map((line) => line.match(/^\s{4}([a-z0-9_-]+):\s*(.*?)\s*$/i))
        .filter(Boolean)
        .map((match) => [match[1], unquote(match[2])])
    );
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
}

export function buildDeploymentManifest(contract, options = {}) {
  const appName = requiredScalar(contract, "app", "name");
  const sourceEnvironment = requiredScalar(contract, "hosting", "environment");
  const environment = options.environment ?? sourceEnvironment;
  if (!/^(dev|prod)$/.test(environment)) {
    throw new Error(`Deployment environment must be dev or prod; found ${environment}.`);
  }

  const displayName = contract.scalar("app", "display_name") ?? appName;
  const location =
    options.azureLocation ?? process.env.AZURE_LOCATION?.trim() ?? contract.scalar("hosting", "location") ?? "australiaeast";
  const names = environmentNames(appName, environment);
  const sourceEnvMatchesTarget = sourceEnvironment === environment;

  const existingRoles = new Map(
    contract.mapList("identity", "app_roles").map((role) => [role.name, role])
  );
  const appRegistrationDisplayName = sourceEnvMatchesTarget
    ? contract.scalar("identity", "app_registration_display_name") ?? names.entraApp
    : names.entraApp;

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    source: {
      contract: contract.contractPath,
      source_environment: sourceEnvironment
    },
    environment,
    app: {
      name: appName,
      display_name: displayName,
      description: contract.scalar("app", "description") ?? ""
    },
    runtime: {
      framework: contract.scalar("runtime", "framework"),
      node_version: contract.scalar("runtime", "node_version"),
      health_path: contract.scalar("runtime", "health_path") ?? "/api/health",
      container_app_mode: contract.scalar("runtime", "container_app_mode"),
      public_ingress: toBoolean(contract.scalar("runtime", "public_ingress"), true),
      target_port: 3000
    },
    azure: {
      location,
      resource_group_name: sourceEnvMatchesTarget
        ? contract.scalar("hosting", "resource_group_name") ?? names.resourceGroup
        : names.resourceGroup,
      container_app_name: sourceEnvMatchesTarget
        ? contract.scalar("hosting", "container_app_name") ?? names.containerApp
        : names.containerApp,
      container_apps_managed_environment_name: sourceEnvMatchesTarget
        ? contract.scalar("hosting", "container_apps_managed_environment_name") ?? names.containerEnvironment
        : names.containerEnvironment,
      managed_identity_name: names.managedIdentity,
      container_registry_name: requiredScalar(contract, "hosting", "container_registry_name"),
      container_registry_login_server: requiredScalar(
        contract,
        "hosting",
        "container_registry_login_server"
      ),
      platform_resource_group_name: contract.scalar("hosting", "platform_resource_group_name") ?? "",
      log_analytics_workspace_name: requiredScalar(contract, "hosting", "log_analytics_workspace_name"),
      log_analytics_workspace_resource_group: requiredScalar(
        contract,
        "hosting",
        "log_analytics_workspace_resource_group"
      )
    },
    lakebase: {
      provider: contract.scalar("database", "provider"),
      database_name: sourceEnvMatchesTarget
        ? contract.scalar("database", "database_name") ?? names.database
        : names.database,
      endpoint_path_env: contract.scalar("database", "endpoint_path_variable") ?? "LAKEBASE_ENDPOINT_PATH",
      pg_host_env: contract.scalar("database", "pg_host_variable") ?? "LAKEBASE_PGHOST",
      pg_port_env: contract.scalar("database", "pg_port_variable") ?? "LAKEBASE_PGPORT",
      pg_database_env: contract.scalar("database", "pg_database_variable") ?? "LAKEBASE_DATABASE",
      pg_user_env: contract.scalar("database", "pg_user_variable") ?? "LAKEBASE_USER",
      pg_user_source_env: "DATABRICKS_CLIENT_ID",
      audit_table_name: contract.scalar("audit", "audit_table_name") ?? "app_audit_events"
    },
    identity: {
      app_registration_required: toBoolean(
        contract.scalar("identity", "entra_app_registration_required"),
        true
      ),
      enterprise_application_required: toBoolean(
        contract.scalar("identity", "enterprise_application_required"),
        true
      ),
      assignment_required: toBoolean(contract.scalar("identity", "assignment_required"), true),
      app_registration_display_name: appRegistrationDisplayName,
      sign_in_audience: contract.scalar("identity", "sign_in_audience") ?? "AzureADMyOrg",
      redirect_uri_path: contract.scalar("identity", "redirect_uri_path") ?? "/api/auth/callback/entra",
      microsoft_graph_permissions: contract.list("identity", "microsoft_graph_permissions"),
      app_roles: [
        roleFor("App.Read", "read"),
        roleFor("App.Write", "write"),
        roleFor("App.Admin", "admin")
      ]
    },
    github: {
      default_branch: contract.scalar("deployment", "default_branch") ?? "main",
      branch_environment_map: contract.map("deployment", "branch_environment_map")
    }
  };

  function roleFor(name, suffix) {
    const existing = existingRoles.get(name) ?? {};
    const roleId = existing.id ?? deterministicUuid(`${appName}:${environment}:${name}`);
    return {
      id: roleId,
      name,
      value: name,
      group_name: `app-${appName}-${environment}-${suffix}`,
      description: existing.description ?? ""
    };
  }
}

export function githubEnvironmentFromManifest(manifest, processEnv = process.env) {
  return {
    APP_DISPLAY_NAME: manifest.app.display_name,
    APP_SLUG: manifest.app.name,
    AUDIT_TABLE_NAME: manifest.lakebase.audit_table_name,
    AZURE_LOCATION: manifest.azure.location,
    ACR_LOGIN_SERVER: manifest.azure.container_registry_login_server,
    ACR_NAME: manifest.azure.container_registry_name,
    CONTAINER_APP: manifest.azure.container_app_name,
    CONTAINER_ENV: manifest.azure.container_apps_managed_environment_name,
    ENTRA_APP_DISPLAY_NAME: manifest.identity.app_registration_display_name,
    ENTRA_REDIRECT_URI_PATH: manifest.identity.redirect_uri_path,
    ENTRA_SIGN_IN_AUDIENCE: manifest.identity.sign_in_audience,
    HEALTH_PATH: manifest.runtime.health_path,
    IDENTITY_NAME: manifest.azure.managed_identity_name,
    LAKEBASE_DATABASE: manifest.lakebase.database_name,
    LAKEBASE_USER: processEnv.DATABRICKS_CLIENT_ID?.trim() ?? "",
    LOG_ANALYTICS_NAME: manifest.azure.log_analytics_workspace_name,
    LOG_ANALYTICS_RG: manifest.azure.log_analytics_workspace_resource_group,
    RESOURCE_GROUP: manifest.azure.resource_group_name
  };
}

function environmentNames(appName, environment) {
  return {
    containerApp: `ca-${appName}-${environment}`,
    containerEnvironment: `cae-${appName}-${environment}`,
    database: lakebaseDatabaseName(appName, environment),
    entraApp: `app-${appName}-${environment}`,
    managedIdentity: `id-app-${appName}-${environment}`,
    resourceGroup: `rg-app-${appName}-${environment}`
  };
}

export function lakebaseDatabaseName(appName, environment) {
  return `db_app_${appName.replaceAll("-", "_")}_${environment}`;
}

function requiredScalar(contract, sectionName, key) {
  const value = contract.scalar(sectionName, key);
  if (!value) {
    throw new Error(`${sectionName}.${key} is required.`);
  }
  return value;
}

function toBoolean(value, defaultValue = false) {
  if (value === undefined) {
    return defaultValue;
  }
  return value === "true";
}

function unquote(value) {
  return value.replace(/^["']|["']$/g, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function deterministicUuid(value) {
  const hash = createHash("sha256").update(value).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
