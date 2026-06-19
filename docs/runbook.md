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
2. Run lint, typecheck and tests.
3. Build the container image.
4. Push the image to the approved registry.
5. Deploy a new Container App revision.
6. Run health checks.
7. Record deployment evidence.

## Rollback

Rollback should use Azure Container Apps revisions. Do not rebuild an older commit just to roll back unless revision rollback is unavailable.

## Database Migration

Run migrations through the controlled workflow identity. Do not run production migrations manually from a local device.

## Audit Verification

For audit-capable apps, confirm:

- A row exists in `app_audit_events`.
- A matching structured event exists in Log Analytics.
- The same `event_id` and `request_id` appear in both places.

## Decommissioning

Foundation apps should retain audit evidence before deletion. The default audit retention target is 1 year unless an app-specific oversight record requires a longer period.
