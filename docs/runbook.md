# Runbook

This runbook records operational procedures for adopted apps.

## Phase 0

Use [phase-0-proof-runbook.md](phase-0-proof-runbook.md) before full build-out.

## Health Check

The standard health endpoint is:

```text
/api/health
```

The endpoint should confirm the app process is healthy. Database checks may be separated if they create cost, latency or dependency risk.

## Deployment

Deployment will run from GitHub Actions once workflows are implemented.

Branch mapping:

- `dev` deploys to the `dev` environment.
- `main` deploys to the `prod` environment.

Container images should be pushed to `acraocappsprod.azurecr.io` with immutable commit SHA tags or digests. Do not rely on `latest`.

Expected sequence:

1. Validate `app.yml`.
2. Syntax-check deployment scripts, typecheck and build.
3. Generate `.generated/deployment-manifest.json` from `app.yml`.
4. Log in to Azure with the platform deployment identity.
5. Provision the Entra app registration, Enterprise Application, app roles and app groups.
6. Provision the Lakebase service-principal role and per-environment app database.
7. Run the Lakebase audit migration.
8. Build the container image.
9. Push the image to the approved registry.
10. Deploy a new Container App revision.
11. Run health and audit endpoint checks.
12. Record deployment evidence.

## Rollback

Rollback should use Azure Container Apps revisions. Do not rebuild an older commit just to roll back unless revision rollback is unavailable.

## Database Migration

Run migrations through the controlled workflow identity. Do not run production migrations manually from a local device.

Current migration command:

```bash
npm run migrate:audit
```

This creates the `app_audit_events` table and its timestamp index in the Lakebase app database before the container revision is deployed.

## Identity Provisioning

Run identity provisioning through GitHub Actions. The local dry-run command is:

```bash
npm run validate:identity
```

Real provisioning command after Azure login:

```bash
npm run provision:entra
```

The command creates or locates the app registration, Enterprise Application, app roles and app groups, then exports Entra IDs for the Container App. See [identity.md](identity.md).

## Audit Verification

For audit-capable apps, confirm:

- A row exists in `app_audit_events`.
- A matching structured event exists in Log Analytics.
- The same `event_id` and `request_id` appear in both places.

## Decommissioning

Foundation apps should retain audit evidence before deletion. The default audit retention target is 1 year unless an app-specific oversight record requires a longer period.
