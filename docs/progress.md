# Progress

This file is the living Markdown progress record for the organisational app template work.

## Phase 0 - Connectivity Proof

Status: complete.

Evidence:

- GitHub Actions Phase 0 Deploy run `27855715133` passed on commit `311171ebb6b137939432cdea27c240a8fc70b8b4`.
- GitHub Actions Validate run `27855715140` passed on the same commit.
- Azure Container App `ca-aoc-app-template-nextjs-dev` reached a ready revision.
- Lakebase database `db-app-aoc-app-template-nextjs-dev` was created.
- `/api/health` returned `status: ok`.
- `/api/audit-test` inserted an audit event into Lakebase.

Key findings:

- `LAKEBASE_ENDPOINT_PATH` must be the Databricks Lakebase endpoint resource path, not the PostgreSQL connection string.
- Azure Container Apps can serve the previous revision immediately after update, so deployment verification must wait for revision readiness.
- Lakebase OAuth service-principal connections require the Databricks application ID as the PostgreSQL role.
- The app needs a dedicated Lakebase database owned by its service-principal role.

Detailed evidence is recorded in [phase-0-results.md](phase-0-results.md).

## Phase 1A - Provisioning Contract Hardening

Status: complete for the initial hardening pass.

Scope:

- Prevent documentation-only pushes from deploying app infrastructure.
- Make `app.yml` a validated app adoption contract.
- Validate standard Azure, Lakebase and Entra group naming.
- Keep Lakebase database and user derivation out of GitHub secrets.
- Rename Lakebase provisioning so the script name matches its role and database scope.

Implementation record:

- Added deploy workflow path filters.
- Added `npm run validate:contract`.
- Added `scripts/validate-app-contract.mjs`.
- Renamed Lakebase provisioning to `scripts/provision-lakebase.mjs`.
- Updated `app.yml` to match the successful `dev` deployment contract.
- Added [app-contract.md](app-contract.md).

Verification:

- `node scripts/validate-app-contract.mjs` passed.
- `node --check scripts/provision-lakebase.mjs` passed.
- `node --check scripts/validate-app-contract.mjs` passed.
- `npm run check` passed.
- GitHub Actions Validate run `27865150636` passed on commit `554576a59c6c3182d6107e4780f556237af9d420`.
- GitHub Actions Phase 0 Deploy run `27865150649` passed on commit `554576a59c6c3182d6107e4780f556237af9d420`.

Remaining follow-up:

- Later phases should move more deployment values from Bash constants into `app.yml` or a generated deployment manifest.

## Phase 1B - Deployment Manifest and Audit Migration

Status: complete.

Scope:

- Generate deployment names and workflow environment values from `app.yml`.
- Use the generated deployment manifest in the GitHub Actions deployment workflow.
- Move Lakebase audit table creation out of runtime request handling and into the deployment migration path.
- Keep the migration and manifest generation resumable from documented commands if automation is interrupted.

Implementation record:

- Added a shared scoped `app.yml` contract reader in `scripts/app-contract.mjs`.
- Added `scripts/generate-deployment-manifest.mjs` to create `.generated/deployment-manifest.json` and export workflow environment values when explicitly requested.
- Updated `.github/workflows/phase-0-deploy.yml` so deployment names, Lakebase database name, Lakebase user, health path and audit table name come from the generated manifest.
- Added `scripts/migrate-lakebase-audit.mjs` and moved audit table creation out of runtime request handling.
- Updated `lib/audit.ts` so runtime inserts only into the configured audit table.
- Updated documentation in `docs/app-contract.md`, `docs/audit.md`, `docs/runbook.md`, `docs/security.md` and `docs/phase-0-proof-runbook.md`.

Local verification:

- `npm run validate:contract` passed.
- `npm run check:scripts` passed.
- `npm run validate:manifest` passed and generated the expected `dev` manifest.
- `node scripts/generate-deployment-manifest.mjs --environment prod --output .generated/deployment-manifest-prod.json` generated the expected `prod` names.
- `npm run check` passed, including TypeScript and the Next.js production build.

Remote verification:

- Commit `7f4fb21bd11a1caf8f3399683f695531f2d8f1b3` pushed to `dev`.
- GitHub Actions Validate run `27865716298` passed.
- GitHub Actions Phase 0 Deploy run `27865716286` passed.
- The deployment run completed `Generate deployment manifest`, `Provision Lakebase role and database`, `Run Lakebase audit migration`, `Verify health endpoint` and `Verify audit endpoint when Lakebase variables are present`.

Remaining follow-up:

- GitHub Actions emitted a Node.js 20 deprecation annotation for marketplace actions that are being forced to Node.js 24. This does not block Phase 1B, but the workflow should move to newer action versions when available.

## Phase 1C - Entra And Access Provisioning Contract

Status: complete for the initial Entra and access provisioning pass.

Scope:

- Provision or locate the Entra app registration and Enterprise Application for each app environment.
- Provision or locate the `app-<app>-<env>-read`, `app-<app>-<env>-write` and `app-<app>-<env>-admin` security groups.
- Assign those groups to matching Entra app roles.
- Export identity outputs to the deployment workflow for later runtime authentication enforcement.
- Update agent-facing guidance so future agents explain and govern the identity process consistently.

Implementation record:

- Added `scripts/provision-entra.mjs` for idempotent Entra app registration, Enterprise Application, app role, security group and group assignment provisioning.
- Extended the generated deployment manifest with Entra app registration, app role and group values.
- Updated `.github/workflows/phase-0-deploy.yml` to run Azure login before identity provisioning, run Entra provisioning and pass Entra IDs to the Container App.
- Updated `app.yml` so Entra app registration and Enterprise Application provisioning are required.
- Added [identity.md](identity.md) and updated the app contract, architecture, security, runbook, oversight and agent guidance documents.
- Added `npm run validate:identity` for dry-run identity plans and `npm run provision:entra` for real provisioning after Azure login.
- Added targeted Microsoft Graph retry handling for newly-created Enterprise Applications and security groups while Graph replication catches up.
- Serialised Phase 0 deployment runs by branch and environment to prevent concurrent push/manual deploys from racing over the same Entra app-role assignments.
- Treated Graph's duplicate `EntitlementGrant entry already exists` response as an idempotent app-role assignment outcome after re-reading the assignment.

Local verification:

- `npm run validate:contract` passed.
- `npm run check:scripts` passed.
- `npm run validate:manifest` passed and generated the expected `dev` identity manifest values.
- `npm run validate:identity` passed and generated the expected `dev` Entra dry-run plan.
- `node scripts/generate-deployment-manifest.mjs --environment prod --output .generated/deployment-manifest-prod.json` generated the expected `prod` manifest.
- `node scripts/provision-entra.mjs --dry-run --manifest .generated/deployment-manifest-prod.json --output .generated/entra-provisioning-plan-prod.json` generated the expected `prod` Entra dry-run plan.
- `npm run check` passed, including TypeScript and the Next.js production build.

Remote verification:

- Commit `ba9efcb80540082868aa235a1432a2e00df79f22` pushed to `dev`.
- GitHub Actions Validate run `27866287494` passed.
- GitHub Actions Phase 0 Deploy run `27866287493` failed at `Provision Entra app registration, Enterprise Application and app groups`.
- The failing Microsoft Graph request was `GET /applications` with `Authorization_RequestDenied` and `Insufficient privileges to complete the operation`.
- Commit `0921ae3e40b7452230ddf40864fd4e47c019c862` recorded the deployment identity setup evidence.
- GitHub Actions Phase 0 Deploy run `27923206949` proved GitHub OIDC login with the new deployment identity, then failed on Microsoft Graph replication delay after creating the Enterprise Application.
- Commit `a93f90d177a780290421bba3554fddbd2375d844` added targeted Graph propagation retries.
- GitHub Actions Phase 0 Deploy run `27923338889` passed end to end from manual dispatch.
- The automatic push deploy run `27923333597` for the same commit failed because it overlapped with the manual dispatch and both runs attempted the same app-role assignment.
- Commit `4aa4fe95c9617a6289544ba395445567530306d8` serialised deploys and made duplicate app-role assignment conflicts idempotent.
- GitHub Actions Validate run `27931495666` passed on commit `4aa4fe95c9617a6289544ba395445567530306d8`.
- GitHub Actions Phase 0 Deploy run `27931495681` passed on commit `4aa4fe95c9617a6289544ba395445567530306d8`.
- The passing deploy run completed Azure login, Entra app registration and Enterprise Application provisioning, Entra group provisioning, group-to-app-role assignments, Lakebase role/database provisioning, audit migration, image build/push, Container App deployment, `/api/health` verification and `/api/audit-test` verification.

Deployment identity setup:

- Created deployment app registration `sp-app-aoc-app-template-nextjs-github-deploy`.
- Application client ID: `ce279577-4b81-4435-9d20-57fb320f54e4`.
- Service principal object ID: `49361eda-48b8-414d-b9a7-e3719355b4f3`.
- Configured GitHub OIDC federated credentials for `repo:EvanExner/AOC-App-Template-NextJS:environment:dev` and `repo:EvanExner/AOC-App-Template-NextJS:environment:prod`.
- Granted and verified Microsoft Graph application roles: `Application.ReadWrite.All`, `Group.ReadWrite.All` and `AppRoleAssignment.ReadWrite.All`.
- Assigned Azure RBAC: `Contributor` on `rg-app-aoc-app-template-nextjs-dev`, `AcrPush` on `acraocappsprod` and `Log Analytics Contributor` on `AOCLogAnalytics`.
- Ensured GitHub environments `dev` and `prod` exist.
- Updated GitHub repo secret `AZURE_CLIENT_ID` to the deployment app registration client ID.

Provisioned app identity evidence:

- App registration: `app-aoc-app-template-nextjs-dev`, client ID `90fe7c34-d0b5-42d1-a3bb-d7524ccaffd3`.
- Enterprise Application object ID: `d53d623b-49a9-4fb0-a2ba-ae06e6970930`, with assignment required.
- Entra groups provisioned and assigned:
  - `app-aoc-app-template-nextjs-dev-read` -> `App.Read`
  - `app-aoc-app-template-nextjs-dev-write` -> `App.Write`
  - `app-aoc-app-template-nextjs-dev-admin` -> `App.Admin`

Known gap:

- `rg-app-aoc-app-template-nextjs-prod` does not exist yet, so the deployment identity does not yet have `Contributor` on the future prod resource group.

## Phase 1D - Runtime Entra Enforcement

Status: complete for automated Phase 1D proof; browser sign-in with a real assigned user remains as a manual access test.

Scope:

- Add Microsoft Entra sign-in for the Next.js runtime.
- Validate Entra ID tokens against tenant OpenID Connect metadata and signing keys.
- Store short-lived encrypted sessions without adding a new runtime dependency.
- Enforce app roles for protected API routes.
- Preserve non-interactive deployment verification for the Lakebase audit endpoint without making the endpoint public.
- Include user and role context in app audit events.

Implementation record:

- Added `/api/auth/login`, `/api/auth/callback/entra`, `/api/auth/logout` and `/api/auth/me`.
- Added dependency-free auth helpers for PKCE, Entra ID-token validation, encrypted session cookies and app-role hierarchy.
- Updated the home page to show Entra session state and app-role assignments.
- Protected `/api/audit-test` with `App.Admin`, with a short-lived deployment verification HMAC for GitHub Actions.
- Updated Entra provisioning to create a runtime app registration credential and export only the secret value to the deployment environment, while persisting only credential metadata.
- Updated deployment to inject `AUTH_SESSION_SECRET` and the generated `ENTRA_CLIENT_SECRET` into the Container App.
- Added a post-deployment Entra provisioning pass so the app registration redirect URI is refreshed after the Container App FQDN is known.
- Updated contract, identity, security, runbook and decommission documentation.

Verification so far:

- `npm run check:scripts` passed.
- `npm run typecheck` passed.
- `npm run check` passed, including contract validation, script syntax checks, manifest generation, Entra dry-run plan, TypeScript and the Next.js production build.
- GitHub repo secret `AUTH_SESSION_SECRET` was created without printing its value.
- GitHub Actions Validate run `27934990281` passed on commit `22aae2a3d6890bc1d84f251beb53a8c2e8042817`.
- GitHub Actions Phase 0 Deploy run `27934990276` passed on commit `22aae2a3d6890bc1d84f251beb53a8c2e8042817`.
- Direct `/api/health` returned 200 and showed auth plus Lakebase runtime configuration.
- Direct unauthenticated `/api/auth/me` returned 401.
- Direct unauthenticated `/api/audit-test` returned 401.
- Direct `/api/auth/login` returned an Entra redirect, but the first implementation used the internal Container Apps origin `https://0.0.0.0:3000` for `redirect_uri`.
- Updated runtime origin detection to prefer `x-forwarded-host` and `x-forwarded-proto` before falling back to the internal Next.js origin.
- After the origin fix deployment, direct `/api/auth/login` used the public Container App FQDN in the Entra `redirect_uri`.
- The app registration had two `aoc-runtime-auth-dev` password credentials after two Phase 1D deployments.
- Added post-deployment stale runtime credential cleanup so the active revision's credential is retained and older generated credentials are removed.
- GitHub Actions Validate run `27990736469` passed on commit `f6a4b0fd74d31a88a24062437940835a8e01e226`.
- GitHub Actions Phase 0 Deploy run `27990736432` failed after Container App deployment while removing stale Entra credentials because Microsoft Graph returned `Directory_ConcurrencyViolation`.
- Added retry/backoff for stale runtime credential removal and classified Graph directory concurrency violations as retriable.
- GitHub Actions Validate run `27991009209` passed on commit `f1b7fe9609c74e8510ddcdef4d89fdfe28647539`.
- GitHub Actions Phase 0 Deploy run `27991009235` passed on commit `f1b7fe9609c74e8510ddcdef4d89fdfe28647539`.
- Direct `/api/health` returned `status: ok`, `runtime.auth.runtime_authentication: true`, `runtime.auth.entra_client_configured: true`, `runtime.auth.session_secret_configured: true` and `runtime.lakebase_configured: true`.
- Direct unauthenticated `/api/auth/me` returned 401.
- Direct unauthenticated `/api/audit-test` returned 401 with `authentication_required`.
- Direct `/api/auth/login` returned 307 to Entra with `redirect_uri=https://ca-aoc-app-template-nextjs-dev.wonderfulcoast-169bb999.australiaeast.azurecontainerapps.io/api/auth/callback/entra`.
- The Entra app registration now has one `aoc-runtime-auth-dev` password credential for the active revision.
- Azure Container App `ca-aoc-app-template-nextjs-dev` is provisioned successfully at revision `ca-aoc-app-template-nextjs-dev--0000015`.

Remaining verification:

- Complete an interactive browser sign-in using a real user assigned to one of the app Entra groups, then confirm the session roles and `App.Admin` access path.

## Phase 1E - Adoption Intake And Project Transformation Workflow

Status: complete for the initial adoption intake scaffolding.

Scope:

- Give future agents a concrete adoption process for bringing an existing local app into the template.
- Add root-level adoption artefacts that capture readiness, adoption work and known gaps.
- Validate adoption and required documentation through the standard local and CI check path.
- Refresh agent-facing guidance so adoption work is consistent across Codex and Claude.

Implementation record:

- Added `AOC_READINESS_REPORT.md` for source app assessment, classification, data review, deployment readiness and oversight signals.
- Added `AOC_ADOPTION_PLAN.md` for workstreams, transformation steps, validation plan, deployment plan and handover.
- Added `AOC_GAP_REGISTER.md` for open gaps, deferred decisions and risk treatment.
- Added `docs/adoption-workflow.md` with required inputs, outputs, agent process, static app conversion guidance, validation gates and oversight triggers.
- Added `scripts/validate-adoption-docs.mjs`.
- Added `npm run validate:docs` and included adoption documentation validation in `npm run check`.
- Replaced the shell-only required docs check in `.github/workflows/validate.yml` with the central `npm run check` path.
- Updated `AGENTS.md`, `CLAUDE.md` and `INSTRUCTIONS.md` so future agents know the adoption artefacts are required.
- Updated `docs/architecture.md` to reflect that runtime Entra enforcement has been implemented.

Verification so far:

- `npm run validate:docs` passed.
- `npm run check:scripts` passed.
- `npm run check` passed, including contract validation, adoption documentation validation, script syntax checks, manifest generation, Entra dry-run plan, TypeScript and the Next.js production build.
- GitHub Actions Validate run `28002591206` passed on commit `911adcd6b572157b9b52ba589acff5eb44c9d065`.
- GitHub Actions Phase 0 Deploy run `28002591239` passed on commit `911adcd6b572157b9b52ba589acff5eb44c9d065`.

Remaining follow-up:

- Use these artefacts against the first real source application and tighten the workflow based on observed gaps.
- Consider adding a source-project inventory script once the first adoption reveals which signals are worth automating.

## Phase 1F - Adoption Issue Capture

Status: complete for the initial issue capture mechanism.

Scope:

- Give client repositories a durable way to record adoption issues encountered while following this template.
- Keep issue capture local to the client repo by default, avoiding automatic cross-repo log disclosure.
- Add a structured GitHub issue form for issues needing discussion, assignment, triage or escalation.
- Validate the issue register and issue form as required adoption artefacts.

Implementation record:

- Added `AOC_ADOPTION_ISSUES.md` with issue capture rules, standard categories, open issue tracking, issue details and closed issue tracking.
- Added `.github/ISSUE_TEMPLATE/aoc-adoption-issue.yml` for structured adoption issue reports.
- Updated `docs/adoption-workflow.md` with issue capture guidance, required fields, escalation rules and sanitisation warnings.
- Updated `AGENTS.md`, `CLAUDE.md` and `INSTRUCTIONS.md` so future agents record blockers in the issue register.
- Updated `AOC_GAP_REGISTER.md` to link related adoption issues.
- Extended `scripts/validate-adoption-docs.mjs` so the issue register and GitHub issue form are required.

Verification so far:

- `npm run validate:docs` passed.
- `npm run check:scripts` passed.
- `npm run check` passed, including contract validation, adoption documentation validation, script syntax checks, manifest generation, Entra dry-run plan, TypeScript and the Next.js production build.
- GitHub Actions Validate run `28004015017` passed on commit `75e4e6b0f73fddcacff6aca0b97b47d4c4cfbe53`.

Remaining follow-up:

- During the first real app trial, use this register for every adoption blocker and decide whether any client-repo issue should be promoted to a central template/platform issue.
