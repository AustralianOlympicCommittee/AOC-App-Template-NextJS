# Decommission Register

This register tracks resources created while proving the organisational app workflow. Before this proof app is retired, use this file to decide what to retain, export, disable or delete.

Status values:

- `retain`: keep as platform capability or durable evidence.
- `remove`: delete when the proof app is no longer needed.
- `review`: confirm with IT or the app owner before changing.

## Current Proof App

App environment: `aoc-app-template-nextjs-dev`

| Area | Component | Identifier | Cleanup status | Notes |
| --- | --- | --- | --- | --- |
| Azure | Resource group | `rg-app-aoc-app-template-nextjs-dev` | remove | Delete after audit evidence is retained or exported. This should remove the Container App, managed environment and managed identity in the app resource group. |
| Azure | Container App | `ca-aoc-app-template-nextjs-dev` | remove | Owned by the dev proof app resource group. |
| Azure | Container Apps managed environment | `cae-aoc-app-template-nextjs-dev` | remove | Owned by the dev proof app resource group. |
| Azure | Managed identity | `id-app-aoc-app-template-nextjs-dev` | remove | Owned by the dev proof app resource group. |
| Azure | Container image tags | `acraocappsprod.azurecr.io/aoc-app-template-nextjs:<commit-sha>` | review | Delete proof image tags only after confirming no active Container App revision references them. Keep the shared registry. |
| Entra | App registration | `app-aoc-app-template-nextjs-dev` | remove | App registration for the proof app environment. |
| Entra | Runtime client credential | `aoc-runtime-auth-dev` on `app-aoc-app-template-nextjs-dev` | remove | Created by deployment for the Entra code exchange. Deleting the app registration should remove it. |
| Entra | Enterprise Application | `app-aoc-app-template-nextjs-dev` | remove | Service principal created from the proof app registration. |
| Entra | Read group | `app-aoc-app-template-nextjs-dev-read` | remove | Confirm no real users or dependent tests still need access. |
| Entra | Write group | `app-aoc-app-template-nextjs-dev-write` | remove | Confirm no real users or dependent tests still need access. |
| Entra | Admin group | `app-aoc-app-template-nextjs-dev-admin` | remove | Confirm no real users or dependent tests still need access. |
| Lakebase | Current database | `db_app_aoc_app_template_nextjs_dev` | review | Current underscore naming standard; retain or export audit rows before deletion. |
| Lakebase | Legacy proof database | `db-app-aoc-app-template-nextjs-dev` | review | Created during the original Phase 0 proof before underscore naming was enforced. Retain or export audit rows before deletion. |
| Lakebase | App audit table | `app_audit_events` in Lakebase app databases | review | Durable proof audit record; retain for the agreed audit period unless exported to an approved store. |
| Lakebase | Database role/user | Databricks service-principal application ID used as `LAKEBASE_USER` | review | Remove only if no other proof database grants depend on it. |
| GitHub | Environment | `dev` | retain | Template environment, not proof-app specific. |
| GitHub | Environment | `prod` | retain | Template environment, not proof-app specific. |
| GitHub | Repository secrets and variables | Azure, Databricks and Lakebase deployment values | retain | Platform configuration for the template. Rotate or remove only if this repo is retired. |
| Logs | Log Analytics records | `AOCLogAnalytics` records for the proof app | retain | Keep for at least the required retention period. Do not delete the shared workspace. |

## Shared Platform Assets

These assets were used by the proof but should not be deleted as part of app cleanup:

| Area | Component | Identifier | Cleanup status | Notes |
| --- | --- | --- | --- | --- |
| Azure | Container Registry | `acraocappsprod` | retain | Shared platform registry. Only prune proof app image tags after revision checks. |
| Azure | Platform resource group | `rg-aoc-app-platform` | retain | Hosts shared platform assets. |
| Azure | Log Analytics workspace | `AOCLogAnalytics` | retain | Shared operational audit and diagnostics workspace. |
| Databricks | Lakebase project | `projects/aoc-apps-prod` | retain | Shared Lakebase project for app databases. |
| Entra | GitHub deployment app registration | `sp-app-aoc-app-template-nextjs-github-deploy` | retain | Platform deployment identity for this template unless the repo is retired. |
| Entra | GitHub deployment service principal | `49361eda-48b8-414d-b9a7-e3719355b4f3` | retain | Keep while GitHub Actions deployments are active. Review Graph permissions periodically. |

## Decommission Checklist

1. Confirm the app is no longer needed and no production path depends on the proof resources.
2. Export or retain Lakebase audit rows according to the oversight record and retention policy.
3. Confirm Log Analytics contains redundant audit evidence for the required period.
4. Disable or remove user access groups before deleting the Enterprise Application.
5. Delete proof app Entra objects and groups.
6. Delete the proof app Azure resource group.
7. Prune unused ACR image tags only after all Container App revisions that reference them are gone.
8. Remove the Lakebase database or database grants only after audit retention requirements are satisfied.
9. Record the completed cleanup in `docs/progress.md` with the deletion date and retained evidence location.
