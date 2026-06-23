# AOC Readiness Report

This report is the first evidence record an agent creates or updates when adopting an existing app into this template.

## App Summary

| Field | Value |
| --- | --- |
| Source project | To be completed during adoption |
| Proposed app name | `aoc-app-template-nextjs` |
| Business owner | To be completed during adoption |
| Technical owner | To be completed during adoption |
| Intended users | To be completed during adoption |
| Primary workflow | To be completed during adoption |
| Expected lifetime | To be completed during adoption |

## Classification

Record the proposed `app.yml` classification before deployment.

| Axis | Current value | Adoption notes |
| --- | --- | --- |
| Scope | `personal` | Must move to `internal` before organisational Azure deployment. |
| Sensitivity | `aoc-public` | Reassess when the real app's data model is known. |
| Timeline | `foundation` | Suitable for proof work until a real support model exists. |

## Data And Integration Assessment

- Data entered by users: To be completed during adoption.
- Data written by the app: To be completed during adoption.
- Databricks Lakebase tables required: To be completed during adoption.
- Shared Databricks, Unity Catalog, Delta Sharing or OpenSharing data required: To be completed during adoption.
- External systems or APIs: To be completed during adoption.
- Sensitive payloads, secrets or credentials observed in source: To be completed during adoption.

## Deployment Readiness

| Area | Status | Notes |
| --- | --- | --- |
| Next.js structure | Not assessed | Convert static or local app code before deployment. |
| Entra roles | Not assessed | Define read, write and admin role needs in `app.yml`. |
| Lakebase database | Not assessed | One database per app environment is the default. |
| Audit trail | Not assessed | Business audit events must write to Lakebase and structured logs. |
| Documentation | Not assessed | Required docs must exist before deployment. |
| GitHub Actions | Not assessed | Validate and deployment workflows must pass. |

## Oversight Signals

Record any item that requires early IT, security, privacy or platform review.

- Production deployment: Not assessed.
- External users or public ingress: Not assessed.
- Custom domain: Not assessed.
- Microsoft Graph permissions: Not assessed.
- AOC-Sensitive data: Not assessed.
- Dedicated Lakebase project: Not assessed.
- Shared Databricks dataset: Not assessed.

## Readiness Outcome

Outcome: Not assessed until a source app is supplied.

Recommended next step: complete this report, then update `AOC_ADOPTION_PLAN.md` and `AOC_GAP_REGISTER.md`.
