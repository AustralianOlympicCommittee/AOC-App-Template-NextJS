# Guidance For AI Coding Agents

Read [INSTRUCTIONS.md](INSTRUCTIONS.md) and [app.yml](app.yml) before making any change.

This repository is the AOC organisational application template for moving local or individual apps into governed Next.js applications on Azure Container Apps, Microsoft Entra and Databricks Lakebase.

## Your Role

Help the user adopt, document, validate and prepare applications for governed deployment. Prefer clear, reversible changes and keep the app aligned to `app.yml`.

## Non-Negotiables

- Use Australian English in user-facing text.
- Do not commit secrets.
- Do not hardcode Databricks, Azure or Entra tenant-specific secrets in source.
- Use one Container App by default; split runtimes only by documented exception.
- Keep application permissions and Azure administration separate.
- Preserve the Entra provisioning flow: app registration, Enterprise Application, app roles and `app-*` security groups come from `app.yml`.
- Use Lakebase database names with underscores.
- Write app audit events to Lakebase and structured redundant audit logs to Log Analytics.
- Keep required documentation current.

## Before Changing Code

1. Read `app.yml`.
2. Read `INSTRUCTIONS.md`.
3. Check whether the request changes scope, sensitivity, timeline, public exposure, database isolation, Entra permissions, or shared Databricks data access.
4. Warn the user with the wording in `INSTRUCTIONS.md` before implementing a risky escalation.

## Adoption Workflow

When asked to adopt an existing app:

1. Inspect the original project.
2. Produce or update `AOC_READINESS_REPORT.md`.
3. Produce or update `AOC_ADOPTION_PLAN.md`.
4. Produce or update `AOC_GAP_REGISTER.md`.
5. Convert simple static pages into Next.js routes.
6. Add or update required docs.
7. Keep deployment secrets as GitHub Environment requirements, not source files.

## Identity Provisioning

- Use `npm run validate:identity` for local dry-run checks.
- Use `npm run provision:entra` only after Azure login through the controlled deployment identity.
- Do not add Microsoft Graph permissions without an oversight record.
- Do not claim runtime Entra protection until token validation and app-role claim checks are implemented in application code.

## Phase 0 Priority

Before full build-out, prove:

- Azure Container App runtime can authenticate to the intended Databricks/Lakebase path.
- Lakebase OAuth database credentials can be minted and rotated.
- The app can connect over SSL and write an audit row.
- The same audit event can be emitted as structured logs for Log Analytics.

Use [docs/phase-0-proof-runbook.md](docs/phase-0-proof-runbook.md) for the proof.
