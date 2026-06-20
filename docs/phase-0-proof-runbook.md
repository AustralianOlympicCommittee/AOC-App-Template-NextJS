# Phase 0 Proof Runbook

Phase 0 proves the riskiest technical path before the full platform build-out.

## Goal

Prove that a minimal Next.js app running in Azure Container Apps can:

1. Authenticate through the intended platform identity path.
2. Mint or obtain short-lived Databricks Lakebase OAuth database credentials.
3. Connect to Lakebase over SSL.
4. Write and read a simple application table.
5. Write a durable audit event to Lakebase.
6. Emit the same audit event as structured logs for Log Analytics.

## Non-Goals

- Full production infrastructure.
- Full user interface.
- Private networking, unless required before any proof of concept.
- Complete promotion or approval workflow.
- Complete Purview integration.

## Inputs Needed

Record answers in [docs/organisational-app-platform-plan.md](docs/organisational-app-platform-plan.md) under `## Requirements`.

### Azure

- Tenant ID: `8f38a566-2ac4-45fd-b5bd-f8097b849ee6`.
- Subscription ID: `d68f6255-86d1-4bc9-829b-0a80d18bbb07`.
- Region: `australiaeast`.
- Container Apps managed environment model: per app environment, for example `cae-<appname>-dev`.
- Azure Container Registry: `acraocappsprod` in `rg-aoc-app-platform`, login server `acraocappsprod.azurecr.io`.
- Log Analytics workspace: `AOCLogAnalytics`.
- Whether Phase 0 should create per-app environment resources where shared platform resources do not yet exist.
- Current known Log Analytics workspace: `AOCLogAnalytics` in `australiaeast`.

### Databricks And Lakebase

- `DATABRICKS_HOST` GitHub Environment secret value: `https://adb-4032175059293983.3.azuredatabricks.net`.
- Shared Lakebase project: `projects/aoc-apps-prod`.
- Shared Lakebase project UID: `b27afc57-8f3f-400a-96bf-86e92e82938e`.
- Whether the first proof uses Databricks service principal auth.

### Entra

- Platform identity can create app registrations: yes.
- Platform identity can create enterprise apps: yes.
- Platform identity can create app roles: yes.
- Platform identity can create groups named `app-*`: yes.
- Platform identity can assign groups to enterprise apps: yes.

### GitHub

- Target organisation: `AustralianOlympicCommittee`.
- This repository is the template repository.
- GitHub Environments are `dev` and `prod`.
- Branch mapping: `dev` deploys to `dev`; `main` deploys to `prod`.

### Audit

- Log Analytics retention target: 1 year minimum.
- Lakebase app audit retention target: 1 year unless overridden.

### Network

- Phase 0 can use public Lakebase connectivity over SSL and locked-down credentials.
- Private networking or VNet posture does not need to be solved before Phase 0.

## Required GitHub Environment Secrets And Variables

Do not commit these values.

Secrets:

- `DATABRICKS_OAUTH_SECRET_1`
- `DATABRICKS_OAUTH_SECRET_2`

Variables:

- `DATABRICKS_HOST`
- `DATABRICKS_CLIENT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_LOCATION`
- `LAKEBASE_ENDPOINT_PATH`
- `LAKEBASE_PGHOST`
- `LAKEBASE_PGPORT`

Current Phase 0 repository secrets already created:

- `AZURE_CLIENT_ID`
- `AZURE_LOCATION`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_TENANT_ID`
- `DATABRICKS_HOST`
- `DATABRICKS_CLIENT_ID`
- `DATABRICKS_OAUTH_SECRET_1`
- `DATABRICKS_OAUTH_SECRET_2`
- `LAKEBASE_ENDPOINT_PATH`
- `LAKEBASE_PGHOST`
- `LAKEBASE_PGPORT`

Lakebase connection values used from the Lakebase Connect dialog:

- `LAKEBASE_ENDPOINT_PATH`, format `projects/{project-id}/branches/{branch-id}/endpoints/{endpoint-id}`. This is the Databricks Lakebase endpoint resource path used by the Databricks API to mint a database credential. It is not the PostgreSQL connection string.
- `LAKEBASE_PGHOST`
- `LAKEBASE_PGPORT`, usually `5432`

The workflow derives:

- `LAKEBASE_DATABASE=db-app-${APP_SLUG}-${DEPLOY_ENV}`
- `LAKEBASE_USER=${DATABRICKS_CLIENT_ID}`

The PostgreSQL connection string from the Lakebase Connect dialog looks like:

```text
postgresql://<user>@<host>/<database>?sslmode=require
```

For that value:

- `LAKEBASE_PGHOST` is the host after `@`, for example `ep-delicate-queen-e44918vp.database.australiaeast.azuredatabricks.net`.
- The path after the host identifies the starter database exposed by the Connect dialog. The workflow does not use that database directly; it provisions a per-app database instead.
- The user before `@` is not used for service-principal runtime connections. The workflow uses the Databricks service-principal application ID as the OAuth Postgres role.

Use a two-level fallback when connecting to Lakebase:

1. Try `DATABRICKS_OAUTH_SECRET_1`.
2. If token minting or connection fails for an authentication-related reason, retry once with `DATABRICKS_OAUTH_SECRET_2`.
3. If both fail, return a sanitised connection failure and log no secret values.

## Proof Steps

1. Create a minimal Next.js app with `/api/health` and `/api/audit-test`.
2. Containerise it with a production Dockerfile.
3. Provision or reference a dev Container App.
4. Configure GitHub Environment secrets.
5. Configure Databricks service principal or federated auth for the proof.
6. Create or reference a Lakebase database named with the `db-app-<app>-<env>` convention.
7. Create an `app_audit_events` table.
8. Implement a Lakebase connection using SSL and short-lived credentials.
9. Implement the Databricks OAuth two-secret fallback.
10. Implement an audit writer that inserts into Lakebase.
11. Emit the same audit event as structured JSON to stdout.
12. Deploy to the dev Container App.
13. Call `/api/health` and `/api/audit-test`.
14. Confirm the audit row exists in Lakebase.
15. Confirm the structured audit event appears in Log Analytics.
16. Document failures, gaps and required platform decisions.

## Success Criteria

- Container App revision is healthy.
- Lakebase connection uses SSL.
- No database password is committed or printed in logs.
- Database credential is short-lived or the limitation is documented as a blocker.
- Databricks OAuth fallback tries both configured secrets without logging either value.
- `app_audit_events` receives the test event.
- Log Analytics receives the structured audit event.
- The same `event_id` and `request_id` appear in both locations.
- Required follow-up decisions are documented.

## Failure Conditions

Stop and record the blocker if:

- Lakebase OAuth database credentials cannot be minted from the intended runtime path.
- Databricks requires a long-lived secret in the application runtime and there is no accepted mitigation.
- Container Apps cannot reach Lakebase under the selected network stance.
- Audit events cannot be routed to Log Analytics.
- The platform identity cannot receive the minimum required Entra or Azure permissions.

## Output

At the end of Phase 0, create or update:

- `docs/phase-0-results.md`
- `docs/security.md`
- `docs/audit.md`
- `docs/runbook.md`
- `app.yml`

Current implementation status is recorded in [phase-0-results.md](phase-0-results.md).
