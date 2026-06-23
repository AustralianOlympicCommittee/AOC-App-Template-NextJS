import { NextRequest, NextResponse } from "next/server";
import { createAuditEvent, writeAuditEvent } from "../../../lib/audit";
import { requireAppRole } from "../../../lib/auth/authorisation";
import { isConfigurationError, sanitiseError } from "../../../lib/errors";
import { logStructured } from "../../../lib/logging";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return runAuditTest(request);
}

export async function POST(request: NextRequest) {
  return runAuditTest(request);
}

async function runAuditTest(request: NextRequest) {
  const authorised = await requireAppRole(request, "App.Admin");
  if (authorised instanceof NextResponse) {
    return authorised;
  }

  const event = createAuditEvent({
    action: "phase0.audit_test",
    actorDisplayName: authorised.user.displayName,
    actorRoles: authorised.user.roles,
    actorUserId: authorised.user.id,
    environment: process.env.APP_ENVIRONMENT ?? "dev",
    metadata: {
      auth_mode: authorised.kind,
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
    const sanitised = sanitiseError(error);
    logStructured("error", "Phase 0 audit endpoint failed.", {
      error_code: sanitised.code,
      error_message: sanitised.message,
      event_id: event.event_id,
      request_id: event.request_id
    });

    const status = isConfigurationError(error) ? 500 : 502;
    return NextResponse.json(
      {
        status: "error",
        event_id: event.event_id,
        request_id: event.request_id,
        error: sanitised
      },
      { status }
    );
  }
}
