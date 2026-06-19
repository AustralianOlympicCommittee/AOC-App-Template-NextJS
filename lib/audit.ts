import { randomUUID } from "crypto";
import type { Client } from "pg";
import { withLakebaseClient } from "./lakebase";
import { logStructured } from "./logging";

export type AuditEventInput = {
  action: string;
  actorDisplayName: string;
  actorRoles: string[];
  actorUserId: string;
  environment: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  resourceId: string;
  resourceType: string;
  result?: "success" | "failure" | "denied" | "error";
};

export type AuditEvent = {
  action: string;
  actor_display_name: string;
  actor_roles: string[];
  actor_user_id: string;
  environment: string;
  event_id: string;
  metadata_json: Record<string, unknown>;
  occurred_at: string;
  request_id: string;
  resource_id: string;
  resource_type: string;
  result: "success" | "failure" | "denied" | "error";
  source_ip_hash: string | null;
};

export function createAuditEvent(input: AuditEventInput): AuditEvent {
  return {
    action: input.action,
    actor_display_name: input.actorDisplayName,
    actor_roles: input.actorRoles,
    actor_user_id: input.actorUserId,
    environment: input.environment,
    event_id: randomUUID(),
    metadata_json: input.metadata ?? {},
    occurred_at: new Date().toISOString(),
    request_id: input.requestId ?? randomUUID(),
    resource_id: input.resourceId,
    resource_type: input.resourceType,
    result: input.result ?? "success",
    source_ip_hash: null
  };
}

export async function writeAuditEvent(event: AuditEvent) {
  emitAuditLog(event);

  const session = await withLakebaseClient(async (client) => {
    await ensureAuditTable(client);
    await client.query(
      `INSERT INTO app_audit_events (
        event_id,
        occurred_at,
        actor_user_id,
        actor_display_name,
        actor_roles,
        action,
        resource_type,
        resource_id,
        environment,
        request_id,
        source_ip_hash,
        result,
        metadata_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)`,
      [
        event.event_id,
        event.occurred_at,
        event.actor_user_id,
        event.actor_display_name,
        event.actor_roles,
        event.action,
        event.resource_type,
        event.resource_id,
        event.environment,
        event.request_id,
        event.source_ip_hash,
        event.result,
        JSON.stringify(event.metadata_json)
      ]
    );
    return true;
  });

  return {
    credentialSource: session.credential.credentialSource,
    inserted: session.result
  };
}

function emitAuditLog(event: AuditEvent) {
  logStructured("info", "Application audit event recorded.", {
    ...event,
    event_type: "app_audit"
  });
}

async function ensureAuditTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_audit_events (
      event_id uuid PRIMARY KEY,
      occurred_at timestamptz NOT NULL,
      actor_user_id text NOT NULL,
      actor_display_name text NOT NULL,
      actor_roles text[] NOT NULL,
      action text NOT NULL,
      resource_type text NOT NULL,
      resource_id text NOT NULL,
      environment text NOT NULL,
      request_id text NOT NULL,
      source_ip_hash text,
      result text NOT NULL CHECK (result IN ('success', 'failure', 'denied', 'error')),
      metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `);
}
