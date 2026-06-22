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

Deployment identity configured for this template:

- App registration: `sp-app-aoc-app-template-nextjs-github-deploy`.
- Application client ID: `ce279577-4b81-4435-9d20-57fb320f54e4`.
- Service principal object ID: `49361eda-48b8-414d-b9a7-e3719355b4f3`.
- GitHub OIDC subjects:
  - `repo:EvanExner/AOC-App-Template-NextJS:environment:dev`
  - `repo:EvanExner/AOC-App-Template-NextJS:environment:prod`
- Microsoft Graph application roles granted and verified:
  - `Application.ReadWrite.All`
  - `Group.ReadWrite.All`
  - `AppRoleAssignment.ReadWrite.All`
- Azure RBAC granted and verified:
  - `Contributor` on `rg-app-aoc-app-template-nextjs-dev`
  - `AcrPush` on `acraocappsprod`
  - `Log Analytics Contributor` on `AOCLogAnalytics`

Known gap:

- `rg-app-aoc-app-template-nextjs-prod` does not exist yet. Add `Contributor` for this deployment service principal when the prod resource group is created.
- Do not work around permission failures by manually creating different group or app registration names; the provisioning contract relies on deterministic names from `app.yml`.

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
