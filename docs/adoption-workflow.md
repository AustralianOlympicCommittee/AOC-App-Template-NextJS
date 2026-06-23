# Adoption Workflow

## Purpose

This workflow explains how an agent should use this repository to adopt an existing local app into the AOC organisational application standard.

The goal is guided self-service. The agent should help the user move quickly while producing the evidence needed for secure deployment, auditability and future support.

## Required Inputs

Before changing deployment settings, collect or infer:

- Source project path or repository.
- Proposed app name and short description.
- Business owner, technical owner and support contact.
- Intended users and whether they are internal or external.
- Expected lifetime: foundation, operational or mature.
- Data entered, stored, exported or shared by the app.
- Required read, write and admin user groups.
- Any external APIs, Microsoft Graph permissions, Databricks datasets, Delta Sharing or OpenSharing requirements.
- Whether public ingress, custom domains, production, sensitive data or a dedicated Lakebase project are needed.

## Adoption Outputs

Every adoption should produce or update:

- `AOC_READINESS_REPORT.md`
- `AOC_ADOPTION_PLAN.md`
- `AOC_GAP_REGISTER.md`
- `AOC_ADOPTION_ISSUES.md`
- `app.yml`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/security.md`
- `docs/audit.md`
- `docs/identity.md`
- `docs/runbook.md`
- `docs/support.md`
- `docs/user-guide.md`
- `docs/oversight.md`

## Agent Process

1. Read `AGENTS.md`, `INSTRUCTIONS.md`, `app.yml` and this workflow.
2. Inspect the source app without changing it.
3. Create or update `AOC_READINESS_REPORT.md` with source structure, users, data, integrations and risk signals.
4. Update `AOC_GAP_REGISTER.md` for missing owners, unknown data flows, unsupported dependencies, secrets in source or deployment blockers.
5. Draft `AOC_ADOPTION_PLAN.md` with workstreams, validation steps and deployment path.
6. Record adoption issues in `AOC_ADOPTION_ISSUES.md` when commands, workflows, deployment steps or instructions fail.
7. Update `app.yml` only after the app name, owner, environment, classification, identity roles and database model are understood.
8. Convert the app to the standard Next.js structure.
9. Add or update Lakebase migrations and audit events.
10. Update required documentation.
11. Run local validation before pushing.
12. Record GitHub Actions and deployment evidence in `docs/progress.md`.

## Static App Conversion

For a simple `index.html` project:

- Convert the main page into `app/page.tsx`.
- Move static images, fonts and downloads into `public/`.
- Move styling into `app/globals.css` or component-level CSS used by the existing app pattern.
- Replace direct browser-side database or secret-bearing calls with `app/api/*` routes.
- Add `app/api/health/route.ts` if it does not exist.
- Keep the first conversion behaviourally small; governance, auth, audit and deployment can then be layered in.

## App Contract Updates

`app.yml` is the source of truth for:

- App name, owner, business unit and cost centre.
- Scope, sensitivity and timeline classification.
- Runtime mode and public ingress.
- Azure resource names and environment.
- Entra app registration, Enterprise Application, app roles and app groups.
- Lakebase database, OAuth credential model and migration command.
- Audit, Log Analytics and Purview expectations.
- GitHub branch and environment mapping.

Do not bypass `app.yml` by hardcoding Azure, Entra, Databricks or GitHub deployment values in source.

## Validation Gates

Run these checks before claiming adoption progress is complete:

- `npm run validate:contract`
- `npm run validate:docs`
- `npm run validate:identity`
- `npm run check`
- GitHub Actions Validate
- Deployment workflow for the target environment when deployment settings or runtime code changed

## Adoption Issue Capture

Use `AOC_ADOPTION_ISSUES.md` for durable local issue tracking in the client repo. Use the GitHub issue form when an issue needs discussion, assignment, triage, or escalation to the template/platform maintainers.

Record an issue when:

- a template direction is unclear or cannot be followed;
- a local validation command fails;
- a GitHub Actions workflow fails;
- Azure, Entra, Lakebase or Log Analytics provisioning behaves unexpectedly;
- an adoption decision is blocked on a user, owner, IT, security or privacy answer;
- a gap in this reference template is discovered.

Each issue should include:

- client repository;
- template version or commit SHA;
- adoption phase;
- category;
- command or workflow step;
- expected result;
- actual result;
- short sanitised error excerpt or GitHub Actions run URL;
- related `AOC_GAP_REGISTER.md` item, if any;
- whether it blocks local work, dev deployment, prod promotion or documentation only.

Do not paste secrets, tokens, raw cookies, full environment dumps, database credentials, full workflow logs or sensitive payloads. Link to logs and include only the smallest useful sanitised excerpt.

If the issue appears to be a template or platform defect, create a structured GitHub issue in the client repo using the `AOC adoption issue` form, then link it from `AOC_ADOPTION_ISSUES.md`. A central reference-repo issue can be created later when the maintainers agree it belongs upstream.

## Oversight Triggers

Pause the risky part of the work and record oversight evidence when adoption introduces:

- Production deployment.
- External users.
- Public ingress or a custom domain.
- AOC-Sensitive data.
- Microsoft Graph permissions.
- Dedicated Lakebase project.
- Shared Databricks, Unity Catalog, Delta Sharing or OpenSharing data.
- Unsupported Azure resources.

## What This Template Tells The Source Project

The adopted project should leave with clear answers to:

- What must change before it can run as an organisational app.
- Which users and groups can access it.
- Which database and audit model it uses.
- Which deployment branch and environment it targets.
- Which gaps block deployment or production promotion.
- Which evidence has been collected and where it is recorded.

## Completion Criteria

An adoption phase is complete when:

1. The app runs locally as a Next.js project.
2. `app.yml` matches the intended classification and environment.
3. Required docs and adoption artefacts are current.
4. Adoption issues are closed, deferred with an owner, or linked to a gap.
5. Local validation passes.
6. CI validation passes.
7. Deployment evidence is recorded when deployment is in scope.
