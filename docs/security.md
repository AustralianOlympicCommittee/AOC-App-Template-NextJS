# Security

This document records authentication, authorisation, secrets, database security and network posture.

## Authentication

Deployed apps use Microsoft Entra authentication through an app registration and enterprise application.

Assignment is group-based. The default groups are:

- `app-{app}-{env}-read`
- `app-{app}-{env}-write`
- `app-{app}-{env}-admin`

## Authorisation

The app should authorise using stable Entra app role claims.

Application permission groups do not grant Azure administration. Azure deployment and administration remain platform-owned.

## Secrets

Do not commit secrets.

Expected GitHub Environment secrets:

- `DATABRICKS_OAUTH_SECRET_1`
- `DATABRICKS_OAUTH_SECRET_2`

Future platform-dispatch secret, not required for the direct Phase 0 workflow:

- `AOC_PLATFORM_DISPATCH_TOKEN`

Expected GitHub Environment variables:

- `DATABRICKS_HOST`
- `DATABRICKS_CLIENT_ID`
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

`LAKEBASE_ENDPOINT_PATH` is the Databricks endpoint resource path used to mint a database credential, for example `projects/{project-id}/branches/{branch-id}/endpoints/{endpoint-id}`. It is not the PostgreSQL connection string.

For Phase 0, the current repository-level Databricks secrets are:

- `DATABRICKS_HOST`
- `DATABRICKS_CLIENT_ID`
- `DATABRICKS_OAUTH_SECRET_1`
- `DATABRICKS_OAUTH_SECRET_2`

This is acceptable for the proof of concept. The application should try `DATABRICKS_OAUTH_SECRET_1` first and, if token minting or connection fails for an authentication-related reason, retry once with `DATABRICKS_OAUTH_SECRET_2` before failing the request. The later platform model should move non-secret values such as host and client ID to GitHub variables, and move reusable platform values to organisation or environment scope.

Where possible, Azure deployment should use OIDC rather than long-lived Azure credentials.

## Lakebase Security

- Use OAuth database credentials with rotation by default.
- Support a two-secret fallback path for Databricks OAuth: try secret 1, then secret 2.
- Require SSL for every database connection.
- Store connection metadata in environment configuration.
- Do not log tokens, passwords or connection strings.
- Dedicated Lakebase projects require IT approval.

## Network Posture

Phase 0 may use public Lakebase connectivity over SSL with locked-down credentials. Revisit private networking before production if app sensitivity, compliance or data-owner requirements demand it.

## Audit

Security-relevant app events must be written to Lakebase and emitted as structured logs for Log Analytics. See [audit.md](audit.md).
