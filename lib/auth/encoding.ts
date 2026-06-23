export function base64UrlEncode(value: Buffer | Uint8Array | string) {
  return Buffer.from(value).toString("base64url");
}

export function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url");
}

export function decodeJwtPart(value: string) {
  return JSON.parse(base64UrlDecode(value).toString("utf8")) as Record<string, unknown>;
}

