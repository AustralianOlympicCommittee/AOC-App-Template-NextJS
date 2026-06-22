import { NextRequest, NextResponse } from "next/server";
import { createAuditEvent, writeAuditEvent } from "../../../../lib/audit";
import { sanitiseError } from "../../../../lib/errors";
import { logStructured } from "../../../../lib/logging";
import { logoutUrl } from "../../../../lib/auth/oidc";
import {
  clearAuthTransactionCookie,
  clearSessionCookie
} from "../../../../lib/auth/session";
import { getUserFromRequest } from "../../../../lib/auth/authorisation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  const response = NextResponse.redirect(logoutUrl(request));
  clearSessionCookie(response, request);
  clearAuthTransactionCookie(response, request);

  if (user) {
    await recordSignOut(user);
  }

  return response;
}

async function recordSignOut(user: {
  displayName: string;
  id: string;
  roles: string[];
}) {
  const event = createAuditEvent({
    action: "auth.sign_out",
    actorDisplayName: user.displayName,
    actorRoles: user.roles,
    actorUserId: user.id,
    environment: process.env.APP_ENVIRONMENT ?? "dev",
    resourceId: "session",
    resourceType: "auth"
  });

  try {
    await writeAuditEvent(event);
  } catch (error) {
    const sanitised = sanitiseError(error);
    logStructured("warn", "Failed to write sign-out audit event.", {
      error_code: sanitised.code,
      error_message: sanitised.message,
      event_id: event.event_id,
      request_id: event.request_id
    });
  }
}

