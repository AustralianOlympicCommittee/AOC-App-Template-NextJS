# Identity Provisioning

This document records the Microsoft Entra identity model for adopted apps.

## Provisioned Objects

Each app environment has its own Entra identity boundary:

- App registration: `app-<app>-<env>`
- Enterprise Application: created from the app registration service principal
- App roles: `App.Read`, `App.Write`, `App.Admin`
- Security groups:
  - `app-<app>-<env>-read`
  - `app-<app>-<env>-write`
  - `app-<app>-<env>-admin`

The deployment workflow runs `npm run provision:entra` after generating the deployment manifest and after Azure login. The script is idempotent: it locates existing objects by display name or app ID, creates missing objects, merges required app roles without deleting unknown roles, and assigns each group to its matching app role.

## Runtime Outputs

The provisioning script exports these values to the GitHub Actions environment for the Container App:

- `ENTRA_CLIENT_ID`
- `ENTRA_TENANT_ID`
- `ENTRA_AUTHORITY`
- `ENTRA_APP_OBJECT_ID`
- `ENTRA_SERVICE_PRINCIPAL_OBJECT_ID`
- `ENTRA_READ_GROUP_ID`
- `ENTRA_WRITE_GROUP_ID`
- `ENTRA_ADMIN_GROUP_ID`

Runtime authentication enforcement is not implemented in Phase 1C. The app receives the identity outputs so the next phase can validate tokens and app role claims without changing the provisioning contract.

## Permissions Boundary

The foundation template does not request Microsoft Graph permissions for the application. Graph permissions require oversight evidence in [oversight.md](oversight.md).

The deployment identity needs Microsoft Graph rights to manage app registrations, service principals, groups and app-role assignments. If GitHub Actions fails at `Provision Entra app registration, Enterprise Application and app groups`, check whether the platform identity has the required Entra role and Graph application permissions.

Observed Phase 1C blocker:

- GitHub Actions Phase 0 Deploy run `27866287493` failed at `Provision Entra app registration, Enterprise Application and app groups`.
- Microsoft Graph returned `Authorization_RequestDenied` and `Insufficient privileges to complete the operation` on `GET /applications`.
- This indicates the Azure deployment identity can log in with OIDC but does not yet have enough Microsoft Graph or Entra directory permission to read and manage app registrations.

Recommended IT handoff:

- Grant the deployment identity an approved Entra role or Graph application permissions that cover app registrations, service principals, groups and app-role assignments.
- Re-run the Phase 0 Deploy workflow for the same commit after permissions are granted.
- Do not work around this by manually creating different group or app registration names; the provisioning contract relies on deterministic names from `app.yml`.

## Local Checks

Run a dry-run plan without creating Entra objects:

```bash
npm run validate:identity
```

This writes `.generated/entra-provisioning-plan.json`, which is ignored by Git.

## Reference APIs

- Microsoft Graph application resource: https://learn.microsoft.com/en-us/graph/api/resources/application
- Microsoft Graph group creation: https://learn.microsoft.com/en-us/graph/api/group-post-groups
- Microsoft Graph group app-role assignment: https://learn.microsoft.com/en-us/graph/api/group-post-approleassignments
