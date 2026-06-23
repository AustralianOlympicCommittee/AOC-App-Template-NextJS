# Phase 0 Results

Status: completed for the `dev` environment on Azure Container Apps and Databricks Lakebase.

Final successful run:

- Branch: `dev`
- Commit: `311171ebb6b137939432cdea27c240a8fc70b8b4`
- GitHub Actions deploy run: `27855715133`
- GitHub Actions validation run: `27855715140`
- Container App: `ca-aoc-app-template-nextjs-dev`
- Resource group: `rg-app-aoc-app-template-nextjs-dev`
- Lakebase database: `db-app-aoc-app-template-nextjs-dev`

## Implemented

- Minimal Next.js app.
- `/api/health` endpoint.
- `/api/audit-test` endpoint.
- Databricks workspace OAuth token request.
- Lakebase database credential request through `/api/2.0/postgres/credentials`.
- Two-secret Databricks OAuth fallback.
- Lakebase PostgreSQL connection over SSL.
- `app_audit_events` table creation.
- Audit row insert.
- Structured `app_audit` log emission before database insert for Log Analytics redundancy.
- Dockerfile.
- GitHub validation workflow.
- GitHub Phase 0 deployment workflow.
- Azure Container Registry: `acraocappsprod.azurecr.io`.
- Azure Container Apps deployment with revision readiness wait.
- Lakebase service-principal role provisioning.
- Lakebase per-app database provisioning using `db-app-<app>-<env>`.

## Deployment Evidence

The final deploy run completed successfully end to end:

- Lakebase service-principal role existed on `projects/aoc-apps-prod/branches/production`.
- Lakebase app database was created: `projects/aoc-apps-prod/branches/production/databases/db-app-aoc-app-template-nextjs-dev`.
- Container App revision became ready: `ca-aoc-app-template-nextjs-dev--0000006`.
- `/api/health` returned `status: ok`.
- `/api/audit-test` returned `status: ok`.
- `/api/audit-test` inserted an audit row with `inserted: true`.
- The audit proof used `DATABRICKS_OAUTH_SECRET_1`.

## Issues Found

- The initial `LAKEBASE_ENDPOINT_PATH` value was a PostgreSQL connection string, but the Databricks API requires the Lakebase endpoint resource path: `projects/{project-id}/branches/{branch-id}/endpoints/{endpoint-id}`.
- Azure Container Apps could serve the previous revision immediately after `az containerapp update`; the workflow now waits until `latestRevisionName` equals `latestReadyRevisionName`.
- `LAKEBASE_USER` as a human-readable service-principal name failed PostgreSQL OAuth authentication. The deployed app now uses the Databricks service-principal application ID as the PostgreSQL role.
- The service-principal role could authenticate but lacked `CREATE` rights in the shared starter database. The workflow now creates a dedicated app database owned by that role.

## Current Secret Model

Required repository or environment secrets/variables for Phase 0:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_LOCATION`
- `DATABRICKS_HOST`
- `DATABRICKS_CLIENT_ID`
- `DATABRICKS_OAUTH_SECRET_1`
- `DATABRICKS_OAUTH_SECRET_2`
- `LAKEBASE_ENDPOINT_PATH`
- `LAKEBASE_PGHOST`
- `LAKEBASE_PGPORT`

No `LAKEBASE_DATABASE` or `LAKEBASE_USER` secret is required for this workflow. The workflow derives:

- `LAKEBASE_DATABASE=db-app-${APP_SLUG}-${DEPLOY_ENV}`
- `LAKEBASE_USER=${DATABRICKS_CLIENT_ID}`

## Local Verification

Completed locally:

- `node --check scripts/provision-lakebase.mjs`
- `node scripts/provision-lakebase.mjs` skip path
- `npm run check`
- `npm audit --audit-level=moderate`
- `docker build --tag aoc-app-template-nextjs:phase0 .`
- local container `/api/health` check

Results:

- Script syntax passed.
- Script skips cleanly when local Lakebase variables are not configured.
- TypeScript compilation passed.
- Next.js production build passed.
- npm audit found 0 vulnerabilities after adding a PostCSS override.
- Docker image built successfully.
- Local container returned `/api/health` with `status: ok`.

## Remaining Risks

- The Lakebase provisioning script currently creates the role and database, but it intentionally does not repair an existing database owned by another role.
- The app creates its own audit table at runtime. A later phase should move schema creation into an explicit migration/provisioning step.
- The GitHub runner reports a Node.js 20 deprecation warning for some third-party Actions even though the workflow itself uses Node 22.
