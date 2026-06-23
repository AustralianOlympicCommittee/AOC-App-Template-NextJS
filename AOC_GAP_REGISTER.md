# AOC Gap Register

This register tracks gaps found while adopting an existing app. Keep it current until each gap is closed, accepted, or explicitly deferred.

## Open Gaps

| ID | Gap | Impact | Owner | Target resolution | Status |
| --- | --- | --- | --- | --- | --- |
| GAP-001 | No source app has been supplied for adoption yet. | Manual user sign-in and real workflow proof remain deferred. | Technical owner | First real adoption | Open |

## Deferred Decisions

| Decision | Deferred until | Required evidence |
| --- | --- | --- |
| Real user-to-role assignment test | A real app and intended user group exist | Browser sign-in evidence and role claim check |
| Production resource group and RBAC | Production deployment is requested | Resource group exists and deployment identity has approved access |
| Shared Databricks dataset access | App requires governed organisational data | Dataset owner, access mode and oversight record |

## Risk Treatment

- Close a gap only when evidence is recorded in this file or the linked progress document.
- Accept a gap only when the owner, impact and review date are recorded.
- Escalate any gap involving AOC-Sensitive data, public ingress, external access, Microsoft Graph permissions or a dedicated Lakebase project.

## Closure Rules

A gap is closed when:

1. The underlying issue has been fixed or the decision has been made.
2. Validation or manual evidence has been recorded.
3. Related documentation has been updated.
