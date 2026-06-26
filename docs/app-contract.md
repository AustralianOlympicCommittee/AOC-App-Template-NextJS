# App Contract

`app.yml` is the app adoption contract for this template. It records the values an agent should use to validate, provision and operate an organisational app.

## Contract Rules

- `app.name` must be a lowercase DNS-style slug using hyphens.
- `runtime.framework` must be `nextjs`.
- `runtime.node_version` must be `22`.
- `runtime.container_app_mode` must be `combined` unless an approved split-runtime exception exists.
- `hosting.azure_deployment` must be `true` for an adopted app.
- Azure resource names must follow:
  - `rg-app-<app>-<env>`
  - `ca-<app>-<env>`
  - `cae-<app>-<env>`
- Lakebase database names must follow `db_app_<app_with_underscores>_<env>`.
- `deployment.default_branch` must be `main`.
- `deployment.branch_environment_map` must map `dev` to `dev` and `main` to `prod`.
- App permission groups must follow:
  - `app-<app>-<env>-read`
  - `app-<app>-<env>-write`
  - `app-<app>-<env>-admin`
- `identity.entra_app_registration_required` and `identity.enterprise_application_required` must be `true`.
- `identity.app_registration_display_name` must follow `app-<app>-<env>`.
- `identity.sign_in_audience` must be `AzureADMyOrg`.
- `identity.assignment_required` must be `true`.
- `identity.microsoft_graph_permissions` must be empty until oversight evidence exists.
- `deployment.required_github_environment_secrets` must include `AUTH_SESSION_SECRET`, `DATABRICKS_OAUTH_SECRET_1` and `DATABRICKS_OAUTH_SECRET_2`.
- `LAKEBASE_DATABASE` and `LAKEBASE_USER` are not required GitHub variables. The workflow derives them from app metadata and the Databricks service-principal application ID.
- Databricks OAuth fallback must try `DATABRICKS_OAUTH_SECRET_1` before `DATABRICKS_OAUTH_SECRET_2`.
- `database.migration_command` must be `npm run migrate:audit`.
- `audit.audit_table_name` must use lowercase letters, numbers and underscores.

## Generated Deployment Manifest

Phase 1B generates a deployment manifest from `app.yml` before provisioning or deployment.

Run:

```bash
npm run generate:manifest -- --environment dev
```

The default output is `.generated/deployment-manifest.json`, which is intentionally ignored by Git because it is an environment-specific build artefact. The GitHub Actions deployment workflow runs the same generator with `--github-env "$GITHUB_ENV"` so later steps use the manifest-derived values for:

- Azure resource group, Container App, Container Apps environment and managed identity names.
- Azure Container Registry and Log Analytics workspace names.
- Lakebase database name, Lakebase user and audit table name.
- Entra app registration display name, redirect path, sign-in audience, app roles and group names.
- App slug, display name and health path.

## Entra Provisioning

Phase 1C provisions identity objects from the generated manifest.

Run a dry-run plan:

```bash
npm run validate:identity
```

Run real provisioning after Azure login:

```bash
npm run provision:entra
```

The deployment workflow runs real provisioning and exports Entra IDs for the Container App. Phase 1D also creates a runtime app registration credential for the Entra code exchange, stores only non-secret metadata in the provisioning record, and injects the secret value into the Container App. See [identity.md](identity.md).

## Validation

Run:

```bash
npm run validate:contract
```

`npm run check` also runs the contract validator before TypeScript and the production build.
It also syntax-checks the deployment scripts, generates the dev deployment manifest and generates a dry-run Entra provisioning plan so manifest and identity drift are caught during CI.

## Current Limits

- The validator is intentionally scoped to this template's `app.yml` shape rather than acting as a general YAML parser.
- The deploy workflow now consumes a generated manifest, but it still provisions Azure resources through inline workflow commands rather than Bicep or a platform dispatch workflow.
- Runtime Entra token validation and user sign-in enforcement are implemented directly in the app for the proof. A later platform pass should evaluate whether this remains the standard approach or is replaced by a shared library or platform auth component.
