import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "../../../../lib/auth/authorisation";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      display_name: user.displayName,
      email: user.email,
      expires_at: user.expiresAt,
      id: user.id,
      roles: user.roles,
      tenant_id: user.tenantId,
      username: user.username
    }
  });
}

