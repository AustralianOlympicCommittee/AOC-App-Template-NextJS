import { NextRequest, NextResponse } from "next/server";
import { createAuditEvent, writeAuditEvent } from "../../../lib/audit";
import { isConfigurationError, sanitiseError } from "../../../lib/errors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return runAuditTest(request);
}

export async function POST(request: NextRequest) {
  return runAuditTest(request);
}

async function runAuditTest(request: NextRequest) {
  const event = createAuditEvent({
    action: "phase0.audit_test",
    actorDisplayName: "Phase 0 proof endpoint",
    actorRoles: ["App.Admin"],
    actorUserId: "phase0-system",
    environment: process.env.APP_ENVIRONMENT ?? "dev",
    metadata: {
      method: request.method,
      user_agent: request.headers.get("user-agent") ?? "unknown"
    },
    requestId: request.headers.get("x-request-id") ?? undefined,
    resourceId: "phase0",
    resourceType: "proof"
  });

  try {
    const result = await writeAuditEvent(event);
    return NextResponse.json({
      status: "ok",
      event_id: event.event_id,
      request_id: event.request_id,
      lakebase: {
        inserted: result.inserted,
        credential_source: result.credentialSource
      }
    });
  } catch (error) {
    const status = isConfigurationError(error) ? 500 : 502;
    return NextResponse.json(
      {
        status: "error",
        event_id: event.event_id,
        request_id: event.request_id,
        error: sanitiseError(error)
      },
      { status }
    );
  }
}
