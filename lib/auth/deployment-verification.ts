import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSessionSecret } from "./config";
import { base64UrlEncode } from "./encoding";

const HEADER = "x-aoc-deployment-verification";
const MAX_SKEW_SECONDS = 5 * 60;

export function isDeploymentVerificationRequest(request: NextRequest) {
  const header = request.headers.get(HEADER);
  if (!header) {
    return false;
  }

  const [timestamp, signature] = header.split(".");
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > MAX_SKEW_SECONDS) {
    return false;
  }

  const expected = deploymentVerificationSignature(
    request.method,
    request.nextUrl.pathname,
    timestamp,
    getSessionSecret()
  );
  return timingSafeEqualString(signature, expected);
}

export function deploymentVerificationSignature(
  method: string,
  pathname: string,
  timestamp: string,
  secret: string
) {
  return base64UrlEncode(
    createHmac("sha256", secret)
      .update([method.toUpperCase(), pathname, timestamp].join("\n"))
      .digest()
  );
}

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

