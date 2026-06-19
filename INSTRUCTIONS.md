# Instructions For Building And Maintaining This Application

This repository defines the AOC organisational application template. It is for adopting a local or individual app into a governed Next.js application that can be deployed to Azure Container Apps, secured by Microsoft Entra, and backed by Databricks Lakebase.

These instructions apply to humans and AI coding agents. `app.yml` is the project contract. Read it before making changes.

## Operating Model

Users own the application idea and code. The platform owns deployment guardrails, Azure resources, Entra setup, Lakebase provisioning, audit requirements, and standard documentation.

The default path is guided self-service, not unrestricted access. Agents should help users progress quickly while preserving evidence, auditability and sensible security boundaries.

## Classification Axes

Every app is governed by three independent axes in `app.yml`.

### Scope

- `personal`: local development only. Must not deploy to Azure or use managed organisational data.
- `internal`: organisation-managed deployment. Requires Entra authentication, assignment groups, Lakebase database, audit records, and internal-only ingress by default.
- `external`: accessible to external users or systems. Requires formal oversight before implementation or deployment.

### Sensitivity

- `aoc-public`: cleared for public release.
- `aoc-confidential`: internal business information. Requires managed database and access controls.
- `aoc-sensitive`: athlete, medical, financial, accreditation, travel, security-operational, staff-personal information, credentials, or similarly sensitive data. Requires formal privacy/security review and must not be used in a foundation prototype.

### Timeline

- `foundation`: short-lived proof of concept. Scale-to-zero, expiry date, no sensitive data, limited support.
- `operational`: persistent team or department app. Requires stronger documentation, monitoring and ownership.
- `mature`: supported business application. Requires production readiness evidence, support model, review date, monitoring and formal oversight.

## Runtime Rules

- Use Next.js for all adopted applications.
- Use one Azure Container App by default, running the Next.js web interface and API routes together.
- Split web/API into separate Container Apps only with a documented exception covering scaling, network, runtime permission, operational ownership, or background-processing need.
- Default ingress is internal-only. Public ingress and custom domains require oversight.
- Use Australian English in user-facing text.

## Entra Rules

Every deployed app must have a Microsoft Entra app registration and enterprise application.

Default app permission groups:

- `app-{app}-{env}-read`
- `app-{app}-{env}-write`
- `app-{app}-{env}-admin`

These groups are assigned to Entra app roles and govern application permissions. They do not grant Azure control-plane administration. Application groups may receive Azure Reader access on their application resource group if useful, but Azure deployment and administration remain platform-owned.

Do not add Microsoft Graph permissions without oversight evidence.

## Lakebase Rules

- Use Databricks Lakebase as the standard transactional database layer.
- Use one shared platform Lakebase project by default, with one database per app environment.
- Dedicated Lakebase projects require IT approval.
- Use PostgreSQL-friendly database identifiers with underscores, for example `db_app_trip_management_prod`.
- Require SSL for every database connection.
- Prefer OAuth database credentials with rotation over long-lived database passwords.
- Prove the Container Apps to Lakebase OAuth token flow before depending on it for production.
- Store workspace-specific values such as `DATABRICKS_HOST` in GitHub Environments, not in source code.

## Audit Rules

Apps must write business audit events to Lakebase and emit structured audit events to Log Analytics through Container Apps logs.

Lakebase is the durable app audit store. Log Analytics is the redundant operational copy for investigation if an app database is deleted, decommissioned, or unavailable.

Do not write secrets or sensitive payloads into logs. Use IDs, hashes, classifications, request IDs and summarised metadata where possible.

Add or update `docs/audit.md` whenever the app introduces authentication, data mutation, administrative functions, exports, sensitive data, or shared Databricks datasets.

## Documentation Rules

Agents must create documentation where it does not exist and update it when behaviour changes.

Required documentation:

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/security.md`
- `docs/audit.md`
- `docs/runbook.md`
- `docs/support.md`
- `docs/user-guide.md`
- `docs/oversight.md`

Foundation apps may start with concise documents, but internal, operational, mature, sensitive or external apps require stronger evidence.

## Source Management Rules

- `main` is the default branch and deploys to `prod`.
- `dev` deploys to the `dev` environment.
- GitHub Environments are `dev` and `prod` by default.
- Pushes to deployment branches deploy only after validation passes.
- Infrastructure, workflow and instruction changes should be protected by CODEOWNERS once the repository is built out.
- Do not commit secrets.

## Agent Escalation Warnings

If a request appears to move the app up a risk axis, warn the user using the relevant wording before implementing the risky part.

Personal to internal:

> This change may move the application from Personal to Internal scope. Confirm the intended audience, sensitivity, owner and deployment path before continuing.

Internal to external:

> This change may move the application from Internal to External scope. Formal SDLC, security, privacy and production oversight are required before implementation or deployment.

Sensitive data:

> This change may raise the information sensitivity to AOC-Sensitive. Formal privacy/security review and a dedicated database or approved isolation model are required, and the app must be at least internal scope.

Dedicated Lakebase project:

> This change requires a dedicated Lakebase project. IT approval is required before provisioning because this changes isolation, cost and lifecycle responsibilities.

Public ingress or custom domain:

> This change exposes the app beyond the default internal boundary. Oversight evidence is required before implementation or deployment.

## Things Not To Do

- Do not bypass `app.yml`.
- Do not hardcode Databricks workspace URLs, client IDs, secrets, tenant IDs or subscription IDs in source code.
- Do not grant application groups Azure Contributor, Owner or User Access Administrator.
- Do not add unsupported Azure resources from an app repository.
- Do not add sensitive data to a foundation app.
- Do not deploy personal apps to Azure.
- Do not log secrets or sensitive payloads.
