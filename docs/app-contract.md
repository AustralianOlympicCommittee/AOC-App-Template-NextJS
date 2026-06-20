# App Contract

`app.yml` is the app adoption contract for this template. It records the values an agent should use to validate, provision and operate an organisational app.

## Phase 1A Contract Rules

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

## Validation

Run:

```bash
npm run validate:contract
```

`npm run check` also runs the contract validator before TypeScript and the production build.

## Deliberate Phase 1A Limits

- The validator is intentionally scoped to this template's `app.yml` shape rather than acting as a general YAML parser.
- The deploy workflow still derives some values directly in Bash. A later phase should load more values from `app.yml` or a generated deployment manifest.
- Entra application registration and group provisioning are documented in the contract but are not automated in Phase 1A.
