# AOC Adoption Plan

This plan records how an existing app will be transformed into the organisational Next.js, Azure Container Apps, Entra and Lakebase standard.

## Target State

- Framework: Next.js.
- Runtime: one Azure Container App per app environment by default.
- Identity: Microsoft Entra app registration, Enterprise Application, app roles and `app-*` groups.
- Database: Databricks Lakebase, one database per app environment.
- Audit: Lakebase app audit events plus structured Log Analytics redundancy.
- Deployment: GitHub Actions from `dev` to dev and `main` to prod.

## Workstreams

| Workstream | Required output | Status |
| --- | --- | --- |
| Source discovery | Source app inventory and risk notes | Not started |
| Contract | Updated `app.yml` | Not started |
| Next.js conversion | Routes, assets and API handlers | Not started |
| Identity | Entra roles mapped to app workflows | Not started |
| Data | Lakebase schema and migration path | Not started |
| Audit | Business audit events and log fields | Not started |
| Documentation | Required docs updated | Not started |
| Validation | Local and CI checks passing | Not started |
| Deployment | Dev deployment evidence recorded | Not started |

## Transformation Steps

1. Inspect the source project structure, runtime assumptions, dependencies, assets and data flows.
2. Complete `AOC_READINESS_REPORT.md` before changing deployment settings.
3. Update `app.yml` with the intended owner, audience, classification, identity, database and deployment settings.
4. Convert static entry points into Next.js routes, usually starting with `app/page.tsx`.
5. Move images, fonts and static files into `public/`.
6. Convert direct browser-side writes or secret-bearing calls into server-side API routes.
7. Add Lakebase migrations for required tables.
8. Add audit calls for sign-in, data mutation, admin changes, exports and sensitive workflows.
9. Update required documentation and keep `AOC_GAP_REGISTER.md` current.
10. Run validation locally before pushing.

## Validation Plan

- Run `npm run validate:contract`.
- Run `npm run validate:docs`.
- Run `npm run validate:identity`.
- Run `npm run check`.
- Confirm GitHub Actions Validate passes.
- Confirm deployment workflow passes before recording the app as deployable.

## Deployment Plan

- Use `dev` for the first organisational deployment.
- Use `main` for production only after owner, support, monitoring and oversight evidence are complete.
- Do not deploy personal apps to Azure.
- Do not enable public ingress, custom domains, external users, Microsoft Graph permissions or dedicated Lakebase projects without oversight evidence.

## Handover

Before handing the app to its owner, record:

- Deployed URL and environment.
- Entra app registration and group names.
- Lakebase database name.
- Audit table name.
- Support contact and escalation route.
- Known gaps and deferred decisions.
