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
- Lakebase database names must follow `db-app-<app>-<env>`.
- `deployment.default_branch` must be `main`.
- `deployment.branch_environment_map` must map `dev` to `dev` and `main` to `prod`.
- App permission groups must follow:
  - `app-<app>-<env>-read`
  - `app-<app>-<env>-write`
  - `app-<app>-<env>-admin`
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
- App slug, display name and health path.

## Validation

Run:

```bash
npm run validate:contract
```

`npm run check` also runs the contract validator before TypeScript and the production build.
It also syntax-checks the deployment scripts and generates the dev deployment manifest so manifest drift is caught during CI.

## Current Limits

- The validator is intentionally scoped to this template's `app.yml` shape rather than acting as a general YAML parser.
- The deploy workflow now consumes a generated manifest, but it still provisions Azure resources through inline workflow commands rather than Bicep or a platform dispatch workflow.
- Entra application registration and group provisioning are documented in the contract but are not automated yet.
