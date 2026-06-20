# Architecture

This document describes the target architecture for apps adopted into this template.

## Runtime

Apps use Next.js and run in one Azure Container App per app environment by default. The same runtime hosts the web interface and API routes.

Split web/API Container Apps are allowed only by documented exception, such as different scale needs, network boundaries, permissions or operational ownership.

## Azure Resources

Each app environment should be contained within one resource group.

Example:

- Resource group: `rg-app-trip-management-prod`
- Container App: `ca-trip-management-prod`
- Container Apps managed environment: `cae-trip-management-prod`
- Managed identity: `id-app-trip-management-prod`
- Log Analytics routing: required
- Optional supporting resources: Key Vault, ACR reference, budget and alerts

The standard region is `australiaeast` unless an approved exception is documented.

Platform registry:

- Azure Container Registry: `acraocappsprod`
- Login server: `acraocappsprod.azurecr.io`
- Resource group: `rg-aoc-app-platform`
- Region: `australiaeast`
- Admin user: disabled

## Identity

Every deployed app uses Microsoft Entra authentication through an app registration and enterprise application.

The deployment workflow provisions one app registration and one Enterprise Application per app environment. The Enterprise Application requires assignment, and access is assigned through app roles.

Default app groups:

- `app-{app}-{env}-read`
- `app-{app}-{env}-write`
- `app-{app}-{env}-admin`

These groups control application access. They do not grant Azure administration.

Phase 1C provisions these identity objects and exports Entra IDs to the Container App. Runtime token and role-claim enforcement is the next implementation phase.

## Database

The standard database is Databricks Lakebase.

The default model is one shared Lakebase project with one database per app environment. Database names use underscores, for example `db_app_trip_management_prod`.

Dedicated Lakebase projects require IT approval.

## Audit

Application audit events are written to Lakebase and emitted as structured logs for Log Analytics redundancy. See [audit.md](audit.md).

## Deployment

`main` is the default branch and deploys to `prod`. The `dev` branch deploys to the `dev` environment. GitHub Actions will validate, provision and deploy through platform-owned workflows once the build-out is implemented.
