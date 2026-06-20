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

Remaining follow-up:

- Confirm GitHub Actions validation passes after the push.
- Later phases should move more deployment values from Bash constants into `app.yml` or a generated deployment manifest.
