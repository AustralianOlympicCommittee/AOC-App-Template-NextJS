# Data Model

This document records the app database model, data ownership and data classification.

## Database

Provider: Databricks Lakebase.

Default database naming pattern:

```text
db_app_<app>_<env>
```

Example:

```text
db_app_trip_management_prod
```

## Required Tables

Every deployed app must include an audit table.

```text
app_audit_events
```

See [audit.md](audit.md) for required fields.

## App Tables

Document app-specific tables here when the app is adopted or implemented.

| Table | Purpose | Owner | Classification | Retention |
| --- | --- | --- | --- | --- |
| To be defined | To be defined | To be defined | To be defined | To be defined |

## Shared Databricks Data

Declare all Unity Catalog, OpenSharing or Delta Sharing datasets in `app.yml` before use.

| Dataset | Source | Purpose | Access Mode | Data Owner | Classification |
| --- | --- | --- | --- | --- | --- |
| To be defined | To be defined | To be defined | To be defined | To be defined | To be defined |

## Migration Rules

- Use a controlled workflow identity for migrations.
- Do not run production migrations manually from a local device.
- Do not store database passwords in source code.
- Require SSL for all database connections.
