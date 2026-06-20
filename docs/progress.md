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
