import { NextRequest, NextResponse } from "next/server";
import { isConfigurationError, sanitiseError } from "../../../../lib/errors";
import {
  buildAuthorisationUrl,
  buildAuthTransaction
} from "../../../../lib/auth/oidc";
import { setAuthTransactionCookie } from "../../../../lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const transaction = buildAuthTransaction(request.nextUrl.searchParams.get("returnTo") ?? "/");
    const url = await buildAuthorisationUrl(request, transaction);
    const response = NextResponse.redirect(url);
    setAuthTransactionCookie(response, request, transaction);
    return response;
  } catch (error) {
    const status = isConfigurationError(error) ? 500 : 502;
    return NextResponse.json(
      {
        error: sanitiseError(error)
      },
      { status }
    );
  }
}

