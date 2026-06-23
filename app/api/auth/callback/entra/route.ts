import { NextRequest, NextResponse } from "next/server";
import { createAuditEvent, writeAuditEvent } from "../../../../../lib/audit";
import { sanitiseError } from "../../../../../lib/errors";
import { logStructured } from "../../../../../lib/logging";
import { completeCodeFlow } from "../../../../../lib/auth/oidc";
import {
  clearAuthTransactionCookie,
  readAuthTransaction,
  setSessionCookie
} from "../../../../../lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    const description = request.nextUrl.searchParams.get("error_description") ?? error;
    return redirectWithError(request, "entra_error", description);
  }

  const transaction = readAuthTransaction(request);
  if (!transaction) {
    return redirectWithError(request, "missing_transaction", "The login transaction expired.");
  }

  const state = request.nextUrl.searchParams.get("state");
  if (state !== transaction.state) {
    return redirectWithError(request, "invalid_state", "The login state did not match.");
  }

  try {
    const user = await completeCodeFlow(request, transaction);
    const response = NextResponse.redirect(new URL(transaction.returnTo, request.nextUrl.origin));
    clearAuthTransactionCookie(response, request);
    setSessionCookie(response, request, user);
    await recordSignIn(user);
    return response;
  } catch (callbackError) {
    const sanitised = sanitiseError(callbackError);
    logStructured("warn", "Entra login callback failed.", {
      error_code: sanitised.code,
      error_message: sanitised.message
    });
    return redirectWithError(request, sanitised.code, sanitised.message);
  }
}

async function recordSignIn(user: {
  displayName: string;
  id: string;
  roles: string[];
}) {
  const event = createAuditEvent({
    action: "auth.sign_in",
    actorDisplayName: user.displayName,
    actorRoles: user.roles,
    actorUserId: user.id,
    environment: process.env.APP_ENVIRONMENT ?? "dev",
    resourceId: "session",
    resourceType: "auth"
  });

  try {
    await writeAuditEvent(event);
  } catch (auditError) {
    const sanitised = sanitiseError(auditError);
    logStructured("warn", "Failed to write sign-in audit event.", {
      error_code: sanitised.code,
      error_message: sanitised.message,
      event_id: event.event_id,
      request_id: event.request_id
    });
  }
}

function redirectWithError(request: NextRequest, code: string, message: string) {
  const url = new URL("/", request.nextUrl.origin);
  url.searchParams.set("auth_error", code);
  url.searchParams.set("auth_message", message.slice(0, 180));
  const response = NextResponse.redirect(url);
  clearAuthTransactionCookie(response, request);
  return response;
}

