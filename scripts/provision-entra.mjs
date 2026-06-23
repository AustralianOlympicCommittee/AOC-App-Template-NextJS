import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildDeploymentManifest, loadAppContract } from "./app-contract.mjs";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = loadDeploymentManifest(args);
  const plan = buildIdentityPlan(manifest);
  const outputPath =
    args.output ?? (args.dryRun ? ".generated/entra-provisioning-plan.json" : ".generated/entra-provisioning.json");

  if (!manifest.identity.app_registration_required || !manifest.identity.enterprise_application_required) {
    throw new Error("Entra app registration and enterprise application provisioning must be enabled.");
  }

  if (args.dryRun) {
    writeOutput(outputPath, {
      ...plan,
      dry_run: true
    });
    console.log(
      `Generated Entra provisioning dry-run plan for ${plan.entra.application.display_name}: ${outputPath}`
    );
    return;
  }

  if (!plan.entra.tenant_id) {
    throw new Error("AZURE_TENANT_ID or ENTRA_TENANT_ID is required for Entra provisioning.");
  }

  const result = await provisionIdentity(plan);
  writeOutput(outputPath, persistedIdentityResult(result));

  if (args.githubEnv) {
    appendGithubEnvironment(args.githubEnv, githubEnvironmentFromIdentity(result));
  }

  console.log(`Entra provisioning complete for ${result.entra.application.display_name}: ${outputPath}`);
}

function loadDeploymentManifest(args) {
  const manifestPath = args.manifest ?? ".generated/deployment-manifest.json";
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    if (args.manifest) {
      throw error;
    }
    const contract = loadAppContract(args.contract ?? "app.yml");
    return buildDeploymentManifest(contract, {
      azureLocation: process.env.AZURE_LOCATION?.trim(),
      environment: args.environment ?? process.env.DEPLOY_ENV?.trim()
    });
  }
}

function buildIdentityPlan(manifest) {
  const tenantId = process.env.ENTRA_TENANT_ID?.trim() || process.env.AZURE_TENANT_ID?.trim() || "";
  const redirectUris = redirectUrisFor(manifest);
  const appRoles = manifest.identity.app_roles.map((role) => ({
    allowedMemberTypes: ["User"],
    description: role.description || `${manifest.app.display_name} ${role.value} access.`,
    displayName: role.value.replace(/^App\./, ""),
    groupName: role.group_name,
    id: role.id,
    isEnabled: true,
    value: role.value
  }));

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    environment: manifest.environment,
    app: manifest.app,
    entra: {
      tenant_id: tenantId,
      authority: tenantId ? `https://login.microsoftonline.com/${tenantId}` : "",
      application: {
        display_name: manifest.identity.app_registration_display_name,
        sign_in_audience: manifest.identity.sign_in_audience,
        redirect_uris: redirectUris
      },
      app_roles: appRoles,
      service_principal: {
        app_role_assignment_required: manifest.identity.assignment_required
      },
      microsoft_graph_permissions: manifest.identity.microsoft_graph_permissions
    }
  };
}

async function provisionIdentity(plan) {
  const application = ensureApplication(plan);
  const runtimeClientSecret = await ensureRuntimeClientSecret(plan, application);
  const servicePrincipal = await ensureServicePrincipal(plan, application);
  const appRoles = appRolesForAssignment(plan.entra.app_roles, servicePrincipal);
  const groups = [];
  const assignments = [];

  for (const role of appRoles) {
    const group = ensureGroup(plan, role);
    const assignment = await ensureGroupAppRoleAssignment(servicePrincipal, group, role);
    groups.push({
      display_name: group.displayName,
      id: group.id,
      role_value: role.value
    });
    assignments.push({
      app_role_id: role.id,
      group_id: group.id,
      id: assignment.id,
      role_value: role.value,
      service_principal_id: servicePrincipal.id
    });
  }

  return {
    ...plan,
    dry_run: false,
    entra: {
      ...plan.entra,
      app_roles: appRoles,
      application: {
        ...plan.entra.application,
        app_id: application.appId,
        object_id: application.id
      },
      runtime_client_secret: {
        display_name: runtimeClientSecret.displayName,
        end_date_time: runtimeClientSecret.endDateTime,
        key_id: runtimeClientSecret.keyId,
        source: runtimeClientSecret.source
      },
      service_principal: {
        ...plan.entra.service_principal,
        app_id: servicePrincipal.appId,
        display_name: servicePrincipal.displayName,
        object_id: servicePrincipal.id
      },
      groups,
      app_role_assignments: assignments
    },
    private_values: {
      entra_client_secret: runtimeClientSecret.secretText
    }
  };
}

function appRolesForAssignment(expectedRoles, servicePrincipal) {
  const actualRolesByValue = new Map(
    (servicePrincipal.appRoles ?? []).map((role) => [role.value, role])
  );
  return expectedRoles.map((role) => {
    const actual = actualRolesByValue.get(role.value);
    if (!actual?.id) {
      throw new Error(
        `Enterprise Application ${servicePrincipal.displayName} does not expose app role ${role.value}.`
      );
    }
    return {
      ...role,
      id: actual.id
    };
  });
}

function ensureApplication(plan) {
  const existingApplications = graphCollection(
    graphUrl("/applications", {
      $filter: `displayName eq '${escapeODataString(plan.entra.application.display_name)}'`,
      $select: "id,appId,displayName,appRoles,passwordCredentials,signInAudience,web"
    })
  );

  if (existingApplications.length > 1) {
    throw new Error(
      `Multiple Entra app registrations found with display name ${plan.entra.application.display_name}.`
    );
  }

  if (existingApplications.length === 0) {
    const created = graphRequest("POST", graphUrl("/applications"), {
      appRoles: plan.entra.app_roles.map(graphAppRole),
      displayName: plan.entra.application.display_name,
      requiredResourceAccess: [],
      signInAudience: plan.entra.application.sign_in_audience,
      web: {
        redirectUris: plan.entra.application.redirect_uris
      }
    });
    console.log(`Created Entra app registration: ${created.displayName}`);
    return created;
  }

  const existing = existingApplications[0];
  const appRoles = mergeAppRoles(existing.appRoles ?? [], plan.entra.app_roles);
  const patch = {
    appRoles,
    signInAudience: plan.entra.application.sign_in_audience
  };
  if (plan.entra.application.redirect_uris.length > 0) {
    patch.web = {
      redirectUris: mergeStrings(existing.web?.redirectUris ?? [], plan.entra.application.redirect_uris)
    };
  }

  graphRequest("PATCH", graphUrl(`/applications/${existing.id}`), patch);
  console.log(`Updated Entra app registration: ${existing.displayName}`);
  return graphRequest(
    "GET",
    graphUrl(`/applications/${existing.id}`, {
      $select: "id,appId,displayName,appRoles,passwordCredentials,signInAudience,web"
    })
  );
}

async function ensureRuntimeClientSecret(plan, application) {
  const configuredSecret = process.env.ENTRA_CLIENT_SECRET?.trim();
  const configuredKeyId = process.env.ENTRA_CLIENT_SECRET_KEY_ID?.trim();
  const displayName = `aoc-runtime-auth-${plan.environment}`;

  if (configuredSecret) {
    const existingCredential =
      (application.passwordCredentials ?? []).find(
        (credential) => configuredKeyId && sameGuid(credential.keyId, configuredKeyId)
      ) ??
      (application.passwordCredentials ?? []).find(
        (credential) => credential.displayName === displayName
      );

    if (configuredKeyId && process.env.ENTRA_CLEANUP_STALE_CLIENT_SECRETS === "true") {
      await cleanupRuntimeClientSecrets(application, displayName, configuredKeyId);
    }

    return {
      displayName,
      endDateTime: existingCredential?.endDateTime ?? "",
      keyId: configuredKeyId || existingCredential?.keyId || "",
      secretText: configuredSecret,
      source: "environment"
    };
  }

  const endDateTime = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  const credential = graphRequest("POST", graphUrl(`/applications/${application.id}/addPassword`), {
    passwordCredential: {
      displayName,
      endDateTime
    }
  });
  if (!credential.secretText) {
    throw new Error(`Microsoft Graph did not return a runtime client secret for ${application.displayName}.`);
  }
  console.log(`Created runtime Entra client secret for ${application.displayName}; expires ${credential.endDateTime}.`);
  return {
    displayName,
    endDateTime: credential.endDateTime,
    keyId: credential.keyId,
    secretText: credential.secretText,
    source: "generated"
  };
}

async function cleanupRuntimeClientSecrets(application, displayName, currentKeyId) {
  const staleCredentials = (application.passwordCredentials ?? []).filter(
    (credential) =>
      credential.displayName === displayName && !sameGuid(credential.keyId, currentKeyId)
  );

  for (const credential of staleCredentials) {
    await graphRequestWithRetry(
      "POST",
      graphUrl(`/applications/${application.id}/removePassword`),
      {
        keyId: credential.keyId
      },
      {
        description: `remove stale runtime Entra client secret ${credential.keyId}`,
        delayMs: 7000
      }
    );
    console.log(`Removed stale runtime Entra client secret ${credential.keyId} from ${application.displayName}.`);
    await delay(3000);
  }
}

async function ensureServicePrincipal(plan, application) {
  const existingServicePrincipals = graphCollection(
    graphUrl("/servicePrincipals", {
      $filter: `appId eq '${escapeODataString(application.appId)}'`,
      $select: "id,appId,displayName,appRoles,appRoleAssignmentRequired"
    })
  );

  if (existingServicePrincipals.length > 1) {
    throw new Error(`Multiple Enterprise Applications found for appId ${application.appId}.`);
  }

  let servicePrincipal = existingServicePrincipals[0];
  if (!servicePrincipal) {
    servicePrincipal = graphRequest("POST", graphUrl("/servicePrincipals"), {
      appId: application.appId
    });
    console.log(`Created Enterprise Application: ${servicePrincipal.displayName}`);
  }

  await graphRequestWithRetry(
    "PATCH",
    graphUrl(`/servicePrincipals/${servicePrincipal.id}`),
    {
      appRoleAssignmentRequired: plan.entra.service_principal.app_role_assignment_required
    },
    {
      description: `Enterprise Application ${servicePrincipal.displayName} settings to become writable`
    }
  );

  return waitForServicePrincipalRoles(servicePrincipal.id, plan.entra.app_roles);
}

async function waitForServicePrincipalRoles(servicePrincipalId, expectedRoles) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const servicePrincipal = await graphRequestWithRetry(
      "GET",
      graphUrl(`/servicePrincipals/${servicePrincipalId}`, {
        $select: "id,appId,displayName,appRoles,appRoleAssignmentRequired"
      }),
      undefined,
      {
        attempts: 3,
        description: `Enterprise Application ${servicePrincipalId} to become readable`
      }
    );

    const values = new Set((servicePrincipal.appRoles ?? []).map((role) => role.value));
    if (expectedRoles.every((role) => values.has(role.value))) {
      return servicePrincipal;
    }

    await delay(5000);
  }

  throw new Error(
    `Timed out waiting for Enterprise Application ${servicePrincipalId} to expose app roles.`
  );
}

function ensureGroup(plan, role) {
  const existingGroups = graphCollection(
    graphUrl("/groups", {
      $filter: `displayName eq '${escapeODataString(role.groupName)}'`,
      $select: "id,displayName,description,mailEnabled,securityEnabled"
    })
  );

  if (existingGroups.length > 1) {
    throw new Error(`Multiple Entra groups found with display name ${role.groupName}.`);
  }

  if (existingGroups.length === 1) {
    const group = existingGroups[0];
    if (group.mailEnabled || !group.securityEnabled) {
      throw new Error(
        `Existing group ${role.groupName} is not a non-mail-enabled security group.`
      );
    }
    return group;
  }

  const group = graphRequest("POST", graphUrl("/groups"), {
    description: `${plan.app.display_name} ${role.value} application access for ${plan.environment}.`,
    displayName: role.groupName,
    mailEnabled: false,
    mailNickname: mailNickname(role.groupName),
    securityEnabled: true
  });
  console.log(`Created Entra security group: ${group.displayName}`);
  return group;
}

async function ensureGroupAppRoleAssignment(servicePrincipal, group, role) {
  const assignments = await graphCollectionWithRetry(
    graphUrl(`/groups/${group.id}/appRoleAssignments`, {
      $select: "id,appRoleId,principalId,resourceId"
    }),
    {
      description: `group ${group.displayName} app-role assignments to become readable`
    }
  );
  const resourceAssignments = assignments.filter(
    (assignment) => sameGuid(assignment.resourceId, servicePrincipal.id)
  );
  const existing = resourceAssignments.find((assignment) => sameGuid(assignment.appRoleId, role.id));
  if (existing) {
    return existing;
  }

  const conflicting = resourceAssignments.find((assignment) => !sameGuid(assignment.appRoleId, role.id));
  if (conflicting) {
    throw new Error(
      `Group ${group.displayName} already has a different app role assignment for ${servicePrincipal.displayName}.`
    );
  }

  try {
    const created = await graphRequestWithRetry(
      "POST",
      graphUrl(`/groups/${group.id}/appRoleAssignments`),
      {
        appRoleId: role.id,
        principalId: group.id,
        resourceId: servicePrincipal.id
      },
      {
        description: `group ${group.displayName} app-role assignment to become writable`
      }
    );
    console.log(`Assigned ${group.displayName} to app role ${role.value}.`);
    return created;
  } catch (error) {
    if (!isExistingAppRoleAssignmentConflict(error)) {
      throw error;
    }

    const refreshedAssignments = await graphCollectionWithRetry(
      graphUrl(`/groups/${group.id}/appRoleAssignments`, {
        $select: "id,appRoleId,principalId,resourceId"
      }),
      {
        description: `group ${group.displayName} app-role assignments after assignment conflict`
      }
    );
    const existingAfterConflict = refreshedAssignments.find(
      (assignment) =>
        sameGuid(assignment.resourceId, servicePrincipal.id) &&
        sameGuid(assignment.appRoleId, role.id)
    );

    if (!existingAfterConflict) {
      throw error;
    }

    console.log(`Group ${group.displayName} already has app role ${role.value}.`);
    return existingAfterConflict;
  }
}

function graphCollection(url) {
  const items = [];
  let nextUrl = url;
  while (nextUrl) {
    const body = graphRequest("GET", nextUrl);
    items.push(...(body.value ?? []));
    nextUrl = body["@odata.nextLink"];
  }
  return items;
}

async function graphCollectionWithRetry(url, options = {}) {
  for (let attempt = 1; attempt <= (options.attempts ?? 12); attempt += 1) {
    try {
      return graphCollection(url);
    } catch (error) {
      if (!isRetriableGraphError(error) || attempt === (options.attempts ?? 12)) {
        throw error;
      }
      logGraphRetry(error, attempt, options.description);
      await delay(options.delayMs ?? 5000);
    }
  }

  return [];
}

function graphRequest(method, url, body) {
  const args = ["rest", "--method", method, "--url", url, "--output", "json"];
  if (body !== undefined) {
    args.push("--headers", "Content-Type=application/json", "--body", JSON.stringify(body));
  }

  try {
    const output = execFileSync("az", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return output.trim() ? JSON.parse(output) : {};
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    const stdout = error.stdout?.toString().trim();
    const details = [stderr, stdout].filter(Boolean).join("\n").slice(0, 2000);
    throw new Error(
      `Microsoft Graph ${method} ${redactUrl(url)} failed.${details ? `\n${details}` : ""}`
    );
  }
}

async function graphRequestWithRetry(method, url, body, options = {}) {
  const attempts = options.attempts ?? 12;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return graphRequest(method, url, body);
    } catch (error) {
      if (!isRetriableGraphError(error) || attempt === attempts) {
        throw error;
      }
      logGraphRetry(error, attempt, options.description);
      await delay(options.delayMs ?? 5000);
    }
  }

  return {};
}

function isRetriableGraphError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Request_ResourceNotFound") ||
    message.includes("Directory_ConcurrencyViolation") ||
    message.includes("TooManyRequests") ||
    message.includes("temporarily unavailable") ||
    /\\b(429|500|502|503|504)\\b/.test(message)
  );
}

function isExistingAppRoleAssignmentConflict(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Request_MultipleObjectsWithSameKeyValue") &&
    message.includes("EntitlementGrant entry already exists")
  );
}

function logGraphRetry(error, attempt, description = "Microsoft Graph resource") {
  const message = error instanceof Error ? error.message : String(error);
  const firstLine = message.split("\\n").find(Boolean) ?? "Graph request failed.";
  console.log(`${description} not ready on attempt ${attempt}; retrying. ${firstLine}`);
}

function graphUrl(path, params = {}) {
  const url = new URL(path.startsWith("https://") ? path : `${GRAPH_ROOT}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function graphAppRole(role) {
  return {
    allowedMemberTypes: role.allowedMemberTypes,
    description: role.description,
    displayName: role.displayName,
    id: role.id,
    isEnabled: true,
    value: role.value
  };
}

function mergeAppRoles(existingRoles, expectedRoles) {
  const merged = [...existingRoles];

  for (const expected of expectedRoles) {
    const index = merged.findIndex((role) => role.value === expected.value);
    if (index === -1) {
      merged.push(graphAppRole(expected));
      continue;
    }
    merged[index] = {
      ...merged[index],
      allowedMemberTypes: expected.allowedMemberTypes,
      description: expected.description,
      displayName: expected.displayName,
      isEnabled: true,
      value: expected.value
    };
  }

  return merged;
}

function redirectUrisFor(manifest) {
  const configured = process.env.ENTRA_REDIRECT_URIS?.trim();
  if (configured) {
    return configured
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    return [];
  }

  return [`${appUrl.replace(/\/+$/, "")}${manifest.identity.redirect_uri_path}`];
}

function githubEnvironmentFromIdentity(result) {
  const values = {
    ENTRA_APP_OBJECT_ID: result.entra.application.object_id,
    ENTRA_AUTHORITY: result.entra.authority,
    ENTRA_CLIENT_SECRET: result.private_values.entra_client_secret,
    ENTRA_CLIENT_SECRET_KEY_ID: result.entra.runtime_client_secret.key_id,
    ENTRA_CLIENT_ID: result.entra.application.app_id,
    ENTRA_SERVICE_PRINCIPAL_OBJECT_ID: result.entra.service_principal.object_id,
    ENTRA_TENANT_ID: result.entra.tenant_id
  };

  for (const role of result.entra.app_roles) {
    const suffix = role.value.replace(/^App\./, "").toUpperCase();
    values[`ENTRA_APP_ROLE_${suffix}_ID`] = role.id;
    const group = result.entra.groups.find((item) => item.role_value === role.value);
    if (group) {
      values[`ENTRA_${suffix}_GROUP_ID`] = group.id;
    }
  }

  return values;
}

function appendGithubEnvironment(path, values) {
  const lines = Object.entries(values).map(([key, value]) => {
    const stringValue = String(value);
    if (!/^[A-Z0-9_]+$/.test(key)) {
      throw new Error(`Invalid GitHub environment key: ${key}`);
    }
    if (/[\r\n]/.test(stringValue)) {
      throw new Error(`GitHub environment value for ${key} must be single-line.`);
    }
    if (process.env.GITHUB_ACTIONS === "true" && /SECRET|TOKEN|PASSWORD/i.test(key)) {
      console.log(`::add-mask::${stringValue}`);
    }
    return `${key}=${stringValue}`;
  });
  appendFileSync(path, `${lines.join("\n")}\n`);
}

function persistedIdentityResult(result) {
  const { private_values: _privateValues, ...persisted } = result;
  return persisted;
}

function writeOutput(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = {
    dryRun: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    const inline = item.match(/^--([a-z-]+)=(.*)$/);
    if (inline) {
      args[toCamelCase(inline[1])] = inline[2];
      continue;
    }

    if (item.startsWith("--")) {
      const key = toCamelCase(item.slice(2));
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`${item} requires a value.`);
      }
      args[key] = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${item}`);
  }
  return args;
}

function mailNickname(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
}

function mergeStrings(first, second) {
  return [...new Set([...first, ...second])];
}

function sameGuid(first, second) {
  return String(first).toLowerCase() === String(second).toLowerCase();
}

function escapeODataString(value) {
  return value.replace(/'/g, "''");
}

function redactUrl(url) {
  const parsed = new URL(url);
  parsed.search = parsed.search ? "?..." : "";
  return parsed.toString();
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}
