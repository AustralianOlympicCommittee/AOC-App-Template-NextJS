import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAuditEvent, writeAuditEvent } from "../audit";
import { sanitiseError } from "../errors";
import { logStructured } from "../logging";
import { isDeploymentVerificationRequest } from "./deployment-verification";
import { SESSION_COOKIE } from "./session";
import { hasAppRole, type AppRole, type AuthenticatedUser } from "./types";
import { getSessionSecret } from "./config";
import { unsealJson } from "./seal";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type AuthorisedActor =
  | {
      kind: "deployment";
      user: AuthenticatedUser;
    }
  | {
      kind: "user";
      user: AuthenticatedUser;
    };

export function getUserFromRequest(request: NextRequest) {
  const sealed = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sealed) {
    return null;
  }
  return unsealJson<AuthenticatedUser>(sealed, getSessionSecret(), SESSION_MAX_AGE_SECONDS);
}

export async function requireAppRole(request: NextRequest, requiredRole: AppRole) {
  if (isDeploymentVerificationRequest(request)) {
    return {
      kind: "deployment",
      user: {
        displayName: "GitHub Actions deployment verification",
        expiresAt: Math.floor(Date.now() / 1000) + 300,
        id: "deployment-workflow",
        roles: ["App.Admin"],
        tenantId: process.env.ENTRA_TENANT_ID ?? "deployment",
        username: "deployment-workflow"
      }
    } satisfies AuthorisedActor;
  }

  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      {
        error: "authentication_required",
        login_url: `/api/auth/login?returnTo=${encodeURIComponent(request.nextUrl.pathname)}`
      },
      { status: 401 }
    );
  }

  if (!hasAppRole(user, requiredRole)) {
    await recordDeniedAudit(request, user, requiredRole);
    return NextResponse.json(
      {
        error: "authorisation_denied",
        required_role: requiredRole,
        roles: user.roles
      },
      { status: 403 }
    );
  }

  return {
    kind: "user",
    user
  } satisfies AuthorisedActor;
}

async function recordDeniedAudit(
  request: NextRequest,
  user: AuthenticatedUser,
  requiredRole: AppRole
) {
  const event = createAuditEvent({
    action: "auth.authorisation_denied",
    actorDisplayName: user.displayName,
    actorRoles: user.roles,
    actorUserId: user.id,
    environment: process.env.APP_ENVIRONMENT ?? "dev",
    metadata: {
      required_role: requiredRole,
      path: request.nextUrl.pathname
    },
    requestId: request.headers.get("x-request-id") ?? undefined,
    resourceId: request.nextUrl.pathname,
    resourceType: "route",
    result: "denied"
  });

  try {
    await writeAuditEvent(event);
  } catch (error) {
    const sanitised = sanitiseError(error);
    logStructured("warn", "Failed to write denied authorisation audit event.", {
      error_code: sanitised.code,
      error_message: sanitised.message,
      event_id: event.event_id,
      request_id: event.request_id
    });
  }
}

