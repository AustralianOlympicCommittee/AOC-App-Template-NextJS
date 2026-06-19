# AOC App Template NextJS

Standard template for adopting local or individual apps into governed Next.js applications on Azure Container Apps, Microsoft Entra and Databricks Lakebase.

## Phase 0

Phase 0 proves the runtime path before the full platform build-out:

- Next.js in one Container App.
- Databricks OAuth with two-secret fallback.
- Lakebase PostgreSQL connection over SSL.
- Lakebase app audit row.
- Structured audit log for Log Analytics redundancy.

See [docs/phase-0-proof-runbook.md](docs/phase-0-proof-runbook.md) and [docs/phase-0-results.md](docs/phase-0-results.md).
