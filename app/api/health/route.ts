import { NextResponse } from "next/server";
import { getRuntimeSummary } from "../../../lib/config";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    status: "ok",
    checked_at: new Date().toISOString(),
    runtime: getRuntimeSummary()
  });
}
