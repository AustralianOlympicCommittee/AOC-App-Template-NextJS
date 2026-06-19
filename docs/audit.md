# Audit And Observability

This document defines the audit model for apps adopted into the AOC organisational application template.

## Principles

- Lakebase is the durable application audit store.
- Log Analytics is the redundant operational copy.
- Entra, Azure and Databricks audit records are complementary platform evidence, not substitutes for app audit events.
- Do not log secrets, tokens, connection strings, raw sensitive records, or unnecessary personal information.
- Every audit event should have a correlation ID that appears in both Lakebase and Log Analytics.

## App Audit Events

Apps must write business audit events to the Lakebase database whenever users or service principals perform important actions.

Required events include:

- Sign-in and sign-out where available to the app.
- Create, update and delete actions.
- Permission or role changes.
- Administrative setting changes.
- Data export, import or bulk read.
- Access to sensitive records.
- Access to shared Databricks datasets.
- Failed authorisation attempts.
- Background jobs or service-account actions that change data.

Recommended table name: `app_audit_events`.

Recommended fields:

| Field | Purpose |
| --- | --- |
| `event_id` | Stable unique event ID. |
| `occurred_at` | UTC timestamp. |
| `actor_user_id` | Entra object ID or service principal ID. |
| `actor_display_name` | Human-readable actor name where safe. |
| `actor_roles` | App roles present in the request. |
| `action` | Normalised action name, such as `trip.created`. |
| `resource_type` | Business object type. |
| `resource_id` | Business object ID. |
| `environment` | `dev`, `test`, `prod`, or another approved value. |
| `request_id` | Correlation ID shared with structured logs. |
| `source_ip_hash` | Hashed source IP where collection is approved. |
| `result` | `success`, `failure`, `denied`, or `error`. |
| `metadata_json` | Minimal non-secret context. |

## Log Analytics Redundancy

The application must also emit structured audit events to stdout so Azure Container Apps can route them to Azure Monitor and Log Analytics.

The Log Analytics copy is for operational redundancy. It helps investigate events when a foundation app is deleted, a Lakebase database is decommissioned, or the app database is unavailable.

For Phase 0 and future apps, emit the structured audit event before attempting the Lakebase insert. This ensures Log Analytics still receives an operational copy if the database is deleted or unavailable.

Structured log requirements:

- Include `event_type: app_audit`.
- Include the same `event_id` and `request_id` as the Lakebase row.
- Include actor IDs and role names where permitted.
- Include resource type and resource ID, not full sensitive payloads.
- Include environment and app name.
- Exclude secrets, tokens, database URLs, client secrets and raw sensitive data.

## Platform Audit Layers

The complete audit picture comes from several systems:

- **Application**: `app_audit_events` table in Lakebase.
- **Runtime**: Container Apps logs, revisions, health checks and structured app logs in Log Analytics.
- **Azure control plane**: Azure Activity Log and diagnostic settings.
- **Identity**: Microsoft Entra sign-in and audit logs routed to Azure Monitor where tenant policy permits.
- **Databricks**: Databricks audit logs and system tables for Lakebase, workspace, data-sharing and permission events.
- **Purview**: Microsoft Purview Data Map and Audit for discovery, classification and compliance investigation where available.

Some Databricks audit events are not available through Azure diagnostic settings. Do not assume Log Analytics contains the complete Databricks audit record.

## Retention

Default retention:

- Lakebase app audit rows: 1 year unless overridden by a documented app requirement.
- Log Analytics audit redundancy: minimum 1 year.
- Existing workspace: `AOCLogAnalytics` in `australiaeast`, currently observed with 730-day retention.

Do not implement automatic deletion of audit rows without explicit approval and a documented retention rule.

## Agent Checklist

When adding authentication, data mutation, admin functions, exports, sensitive data or shared Databricks data:

1. Update this document.
2. Add or update the audit table migration.
3. Add or update structured audit log emission.
4. Confirm no sensitive payloads are logged.
5. Add tests for audit writes where practical.
6. Update `docs/security.md` and `docs/runbook.md` if operational handling changes.
