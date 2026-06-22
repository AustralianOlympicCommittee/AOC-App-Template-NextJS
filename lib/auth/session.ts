import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { getSessionSecret } from "./config";
import { sealJson, unsealJson } from "./seal";
import type { AuthenticatedUser } from "./types";

export const SESSION_COOKIE = "aoc_session";
export const AUTH_TRANSACTION_COOKIE = "aoc_auth_transaction";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const TRANSACTION_MAX_AGE_SECONDS = 10 * 60;

export type AuthTransaction = {
  codeVerifier: string;
  createdAt: number;
  nonce: string;
  returnTo: string;
  state: string;
};

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sealed) {
    return null;
  }
  return unsealJson<AuthenticatedUser>(sealed, getSessionSecret(), SESSION_MAX_AGE_SECONDS);
}

export function readAuthTransaction(request: NextRequest) {
  const sealed = request.cookies.get(AUTH_TRANSACTION_COOKIE)?.value;
  if (!sealed) {
    return null;
  }
  return unsealJson<AuthTransaction>(sealed, getSessionSecret(), TRANSACTION_MAX_AGE_SECONDS);
}

export function setAuthTransactionCookie(
  response: NextResponse,
  request: NextRequest,
  transaction: AuthTransaction
) {
  response.cookies.set(AUTH_TRANSACTION_COOKIE, sealJson(transaction, getSessionSecret()), {
    httpOnly: true,
    maxAge: TRANSACTION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(request)
  });
}

export function clearAuthTransactionCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(AUTH_TRANSACTION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(request)
  });
}

export function setSessionCookie(
  response: NextResponse,
  request: NextRequest,
  user: AuthenticatedUser
) {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = Math.max(0, Math.min(SESSION_MAX_AGE_SECONDS, user.expiresAt - now));
  response.cookies.set(SESSION_COOKIE, sealJson(user, getSessionSecret()), {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(request)
  });
}

export function clearSessionCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(request)
  });
}

function isSecureRequest(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
}

