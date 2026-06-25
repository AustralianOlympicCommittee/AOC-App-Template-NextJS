# AOC App Template NextJS

This repository is the AOC organisational application template for turning small local apps into governed, deployable internal applications.

It is designed for the point where a user has built a useful individual app, perhaps only an `index.html`, and wants to make it organisation-ready without inventing the deployment, identity, data, audit and documentation model from scratch.

First trial baseline: `adoption-trial-0.1.0`

## What This Template Provides

- A standard Next.js application structure.
- One Azure Container App per app environment by default.
- Microsoft Entra app registration, Enterprise Application, app roles and `app-*` access groups.
- Databricks Lakebase as the transactional database layer, with one database per app environment.
- OAuth-based Lakebase connectivity with fallback credentials.
- Lakebase application audit events plus structured logs for Log Analytics redundancy.
- GitHub Actions validation and deployment workflows.
- A governed `app.yml` contract for ownership, classification, runtime, identity, database, audit and deployment settings.
- Agent-facing instructions for adopting, documenting and validating client apps.
- Adoption artefacts and issue capture so problems are not lost in chat or workflow logs.

## Intended Adoption Flow

1. A user brings a local prototype or simple app.
2. An agent reads `AGENTS.md`, `INSTRUCTIONS.md`, `app.yml` and `docs/adoption-workflow.md`.
3. The agent creates or updates:
   - `AOC_READINESS_REPORT.md`
   - `AOC_ADOPTION_PLAN.md`
   - `AOC_GAP_REGISTER.md`
   - `AOC_ADOPTION_ISSUES.md`
4. The source app is converted into the standard Next.js structure.
5. `app.yml` is updated to describe the app, environment, identity, data and deployment contract.
6. Required documentation is completed.
7. Validation and deployment workflows prove the app can run in the governed Azure, Entra and Lakebase model.

The process is guided self-service, not an approval queue. Oversight is required only when the app crosses a risk boundary such as production, external access, public ingress, sensitive data, Microsoft Graph permissions, dedicated Lakebase projects or shared Databricks datasets.

## Architecture Standard

The default deployed shape is:

- GitHub repository for the adopted app.
- Azure resource group per app environment.
- Azure Container App running Next.js web and API routes together.
- Microsoft Entra app registration and Enterprise Application.
- Entra app roles:
  - `App.Read`
  - `App.Write`
  - `App.Admin`
- Entra groups:
  - `app-{app}-{env}-read`
  - `app-{app}-{env}-write`
  - `app-{app}-{env}-admin`
- Databricks Lakebase database per app environment.
- Application audit table in Lakebase.
- Structured audit logs emitted to Container Apps logs for Log Analytics.

Split web/API Container Apps are allowed only by documented exception.

## Key Files

| File | Purpose |
| --- | --- |
| `app.yml` | Single source of truth for app governance, provisioning and deployment. |
| `AGENTS.md` | Codex and agent operating guidance. |
| `CLAUDE.md` | Claude-specific entry point. |
| `INSTRUCTIONS.md` | Human and agent rules for maintaining adopted apps. |
| `docs/adoption-workflow.md` | Step-by-step adoption process for client apps. |
| `docs/organisational-app-platform-plan.md` | Platform-level architecture and roadmap. |
| `docs/progress.md` | Living progress and evidence log. |
| `docs/runbook.md` | Deployment and operating sequence. |
| `docs/identity.md` | Entra provisioning and runtime authentication notes. |
| `docs/audit.md` | Lakebase and Log Analytics audit model. |
| `AOC_READINESS_REPORT.md` | Adoption readiness evidence. |
| `AOC_ADOPTION_PLAN.md` | Adoption work plan. |
| `AOC_GAP_REGISTER.md` | Known adoption gaps and deferred decisions. |
| `AOC_ADOPTION_ISSUES.md` | Adoption issue register for blockers and failures. |

## Validation

Install dependencies:

```powershell
npm ci
```

Run the full local check:

```powershell
npm run check
```

Useful targeted checks:

```powershell
npm run validate:contract
npm run validate:docs
npm run validate:identity
npm run validate:manifest
```

## Deployment Model

Branch mapping:

- `dev` deploys to the `dev` environment.
- `main` is the stable reference branch and maps to `prod` for adopted apps.

For this reference template, production deployment should not be used until the production resource group, RBAC and environment secrets/variables are intentionally prepared.

GitHub organisation-level variables and secrets should hold shared platform values where possible. App-specific secrets, such as `AUTH_SESSION_SECRET`, should remain per app/environment.

## Current Status

Implemented and verified:

- Phase 0: Azure Container App to Lakebase connectivity and audit proof.
- Phase 1A: `app.yml` contract hardening.
- Phase 1B: generated deployment manifest and audit migration.
- Phase 1C: Entra app registration, Enterprise Application, app roles and groups.
- Phase 1D: runtime Entra sign-in, session protection and role enforcement.
- Phase 1E: adoption workflow and required adoption artefacts.
- Phase 1F: local adoption issue capture and GitHub issue form.

The next practical step is to trial the template against a small sample app and record every adoption gap or failure in `AOC_ADOPTION_ISSUES.md`.

## Security Notes

- Do not commit secrets.
- Do not hardcode Azure, Entra or Databricks tenant-specific secrets in source.
- Do not grant app access groups Azure control-plane administration.
- Do not log secrets or sensitive payloads.
- Do not deploy personal apps to Azure.
- Public ingress, external users, custom domains, sensitive data, Microsoft Graph permissions and dedicated Lakebase projects require oversight evidence.
