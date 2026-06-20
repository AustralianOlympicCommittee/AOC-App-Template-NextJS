import { randomUUID } from "crypto";
import { ConfigurationError } from "./errors";
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

  const auditTable = auditTableIdentifier();
  const session = await withLakebaseClient(async (client) => {
    await client.query(
      `INSERT INTO ${auditTable} (
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

function auditTableIdentifier() {
  const tableName = process.env.AUDIT_TABLE_NAME?.trim() || "app_audit_events";
  if (!/^[a-z][a-z0-9_]*$/.test(tableName)) {
    throw new ConfigurationError(
      "AUDIT_TABLE_NAME must use lowercase letters, numbers and underscores."
    );
  }
  return `"${tableName}"`;
}
