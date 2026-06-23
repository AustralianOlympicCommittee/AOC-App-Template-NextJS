# AOC Adoption Issues

This register captures issues encountered while a client repository follows this template's adoption directions.

Use this file for durable local tracking. Use the GitHub issue form when an issue needs discussion, assignment, triage or linking to a template/platform defect.

## Issue Capture Rules

- Record adoption blockers here as they are found.
- Do not paste secrets, tokens, full environment dumps, raw cookies, database credentials or sensitive payloads.
- Prefer short sanitised error excerpts over full logs.
- Link to GitHub Actions runs instead of copying long workflow logs.
- Link related gaps in `AOC_GAP_REGISTER.md`.
- Escalate likely template or platform defects by creating a structured GitHub issue in the client repo and linking it here.

## Categories

- `adoption-intake`
- `nextjs-conversion`
- `app-contract`
- `github-actions`
- `azure-provisioning`
- `entra-identity`
- `lakebase-database`
- `audit-logging`
- `documentation`
- `platform-defect`
- `user-decision-required`

## Open Issues

| ID | Category | Phase | Summary | Blocks | Related gap | Status |
| --- | --- | --- | --- | --- | --- | --- |
| ISSUE-001 | `user-decision-required` | Phase 1D | Manual browser sign-in proof is deferred until a real adopted app and user group exist. | Full end-user access proof | `GAP-001` | Deferred |

## Issue Details

### ISSUE-001 - Manual Browser Sign-In Proof Deferred

- Category: `user-decision-required`
- Phase: Phase 1D
- Source: template build-out
- Command or workflow: not applicable
- Expected result: a real user assigned to an app Entra group signs in and confirms role-based access.
- Actual result: deferred until there is a real application and intended user group.
- Sanitised evidence: automated checks confirm public health, protected unauthenticated routes and Entra redirect URI; manual user session remains intentionally untested.
- Next action: complete during the first real app adoption.

## Closed Issues

| ID | Category | Summary | Resolution | Evidence |
| --- | --- | --- | --- | --- |
