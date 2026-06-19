# Phase 0 Results

Status: implemented and locally verified through build, audit and container health. Azure/Lakebase end-to-end execution is still pending.

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

## Not Yet Executed

The proof has not yet been run against Azure Container Apps and Lakebase.

Required values still need to be configured in GitHub variables:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_LOCATION`
- `LAKEBASE_SHARED_PROJECT_NAME`
- `LAKEBASE_ENDPOINT_PATH`
- `LAKEBASE_PGHOST`
- `LAKEBASE_PGPORT`
- `LAKEBASE_DATABASE`
- `LAKEBASE_USER`
- `CONTAINER_REGISTRY_LOGIN_SERVER`

Note: `LAKEBASE_ENDPOINT_PATH` must be the Databricks endpoint resource path, for example `projects/{project-id}/branches/{branch-id}/endpoints/{endpoint-id}`. It is not the PostgreSQL connection string. The connection string you shared should be split into `LAKEBASE_PGHOST`, `LAKEBASE_DATABASE`, and `LAKEBASE_USER`, but the credential endpoint path still needs to come from the Lakebase endpoint resource name.

Required values already created as repository secrets:

- `DATABRICKS_HOST`
- `DATABRICKS_CLIENT_ID`
- `DATABRICKS_OAUTH_SECRET_1`
- `DATABRICKS_OAUTH_SECRET_2`

Required values still expected as repository or environment secrets:

- None for the direct Phase 0 workflow beyond the Databricks OAuth secrets already listed.
- `AOC_PLATFORM_DISPATCH_TOKEN` is only required later if the final platform-dispatch path is used.

## Local Verification

Completed locally:

- `npm install`
- `npm run check`
- `npm audit --audit-level=moderate`
- `docker build --tag aoc-app-template-nextjs:phase0 .`
- local container `/api/health` check

Results:

- TypeScript compilation passed.
- Next.js production build passed.
- npm audit found 0 vulnerabilities after adding a PostCSS override.
- Docker image built successfully.
- Local container returned `/api/health` with `status: ok`.

## Remaining Verification Gap

The first GitHub Actions run should verify:

- image push to `acraocappsprod.azurecr.io`
- Container App deployment
- deployed health endpoint
- audit endpoint, once Lakebase variables are corrected and complete

## Expected Success Criteria

- `/api/health` returns `status: ok`.
- `/api/audit-test` emits a structured `app_audit` log event.
- `/api/audit-test` writes a row to `app_audit_events`.
- If `DATABRICKS_OAUTH_SECRET_1` fails, the app retries with `DATABRICKS_OAUTH_SECRET_2`.
- No secret values appear in application responses or logs.
