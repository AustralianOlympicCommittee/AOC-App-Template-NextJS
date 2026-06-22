import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { ExternalServiceError } from "../errors";
import {
  authorizeEndpoint,
  getAuthConfig,
  metadataEndpoint,
  tokenEndpoint,
  type AuthConfig
} from "./config";
import { base64UrlDecode, base64UrlEncode, decodeJwtPart } from "./encoding";
import type { AuthTransaction } from "./session";
import { normaliseAppRoles, type AuthenticatedUser } from "./types";

type OpenIdConfiguration = {
  issuer: string;
  jwks_uri: string;
};

type JsonWebKeySet = {
  keys: JsonWebKey[];
};

type JsonWebKey = {
  alg?: string;
  e: string;
  kid: string;
  kty: string;
  n: string;
  use?: string;
};

type TokenResponse = {
  error?: string;
  error_description?: string;
  expires_in?: number;
  id_token?: string;
  token_type?: string;
};

const metadataCache = new Map<string, Promise<OpenIdConfiguration>>();
const jwksCache = new Map<string, Promise<JsonWebKeySet>>();

export function buildAuthTransaction(returnTo: string): AuthTransaction {
  return {
    codeVerifier: randomToken(64),
    createdAt: Math.floor(Date.now() / 1000),
    nonce: randomToken(32),
    returnTo: safeReturnTo(returnTo),
    state: randomToken(32)
  };
}

export async function buildAuthorisationUrl(request: NextRequest, transaction: AuthTransaction) {
  const config = getAuthConfig();
  const redirectUri = callbackUrl(request);
  const url = new URL(authorizeEndpoint(config));
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", transaction.state);
  url.searchParams.set("nonce", transaction.nonce);
  url.searchParams.set("code_challenge", codeChallenge(transaction.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function completeCodeFlow(request: NextRequest, transaction: AuthTransaction) {
  const config = getAuthConfig();
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    throw new ExternalServiceError("The Entra callback did not include an authorisation code.", "missing_code");
  }

  const tokenResponse = await redeemCode(config, code, callbackUrl(request), transaction.codeVerifier);
  if (!tokenResponse.id_token) {
    throw new ExternalServiceError("The Entra token response did not include an ID token.", "missing_id_token");
  }

  return validateIdToken(config, tokenResponse.id_token, transaction.nonce);
}

export function callbackUrl(request: NextRequest) {
  return new URL("/api/auth/callback/entra", request.nextUrl.origin).toString();
}

export function logoutUrl(request: NextRequest) {
  const config = getAuthConfig();
  const url = new URL(`${config.authority}/oauth2/v2.0/logout`);
  url.searchParams.set("post_logout_redirect_uri", new URL("/", request.nextUrl.origin).toString());
  return url;
}

async function redeemCode(
  config: AuthConfig,
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    scope: "openid profile email"
  });

  const response = await fetch(tokenEndpoint(config), {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });
  const tokenResponse = (await response.json()) as TokenResponse;
  if (!response.ok || tokenResponse.error) {
    throw new ExternalServiceError(
      tokenResponse.error_description || "The Entra token endpoint rejected the authorisation code.",
      tokenResponse.error || "token_exchange_failed"
    );
  }
  return tokenResponse;
}

async function validateIdToken(
  config: AuthConfig,
  idToken: string,
  expectedNonce: string
): Promise<AuthenticatedUser> {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new ExternalServiceError("The Entra ID token is malformed.", "malformed_id_token");
  }

  const header = decodeJwtPart(encodedHeader);
  const claims = decodeJwtPart(encodedPayload);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new ExternalServiceError("The Entra ID token uses an unsupported signing key.", "unsupported_id_token_key");
  }

  const metadata = await getOpenIdConfiguration(config);
  const jwks = await getJwks(metadata.jwks_uri);
  const jwk = jwks.keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    jwksCache.delete(metadata.jwks_uri);
    throw new ExternalServiceError("The Entra signing key was not found.", "missing_signing_key");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
    false,
    ["verify"]
  );
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlDecode(encodedSignature),
    Buffer.from(`${encodedHeader}.${encodedPayload}`)
  );
  if (!validSignature) {
    throw new ExternalServiceError("The Entra ID token signature is invalid.", "invalid_signature");
  }

  validateClaims(config, metadata, claims, expectedNonce);

  const username = stringClaim(claims, "preferred_username") || stringClaim(claims, "email") || "unknown";
  return {
    displayName: stringClaim(claims, "name") || username,
    email: stringClaim(claims, "email") || username,
    expiresAt: numberClaim(claims, "exp"),
    id: stringClaim(claims, "oid") || stringClaim(claims, "sub"),
    roles: normaliseAppRoles(claims.roles),
    tenantId: stringClaim(claims, "tid"),
    username
  };
}

function validateClaims(
  config: AuthConfig,
  metadata: OpenIdConfiguration,
  claims: Record<string, unknown>,
  expectedNonce: string
) {
  const now = Math.floor(Date.now() / 1000);
  const audience = claims.aud;
  const audiences = Array.isArray(audience) ? audience.map(String) : [String(audience ?? "")];
  if (!audiences.includes(config.clientId)) {
    throw new ExternalServiceError("The Entra ID token audience does not match this app.", "invalid_audience");
  }

  if (claims.iss !== metadata.issuer) {
    throw new ExternalServiceError("The Entra ID token issuer does not match this tenant.", "invalid_issuer");
  }
  if (claims.tid !== config.tenantId) {
    throw new ExternalServiceError("The Entra ID token tenant does not match this app.", "invalid_tenant");
  }
  if (claims.nonce !== expectedNonce) {
    throw new ExternalServiceError("The Entra ID token nonce does not match the login transaction.", "invalid_nonce");
  }
  if (numberClaim(claims, "exp") <= now) {
    throw new ExternalServiceError("The Entra ID token has expired.", "expired_id_token");
  }
  const notBefore = optionalNumberClaim(claims, "nbf");
  if (notBefore && notBefore > now + 60) {
    throw new ExternalServiceError("The Entra ID token is not valid yet.", "id_token_not_yet_valid");
  }
}

async function getOpenIdConfiguration(config: AuthConfig) {
  const endpoint = metadataEndpoint(config);
  let promise = metadataCache.get(endpoint);
  if (!promise) {
    promise = fetchJson<OpenIdConfiguration>(endpoint, "openid_configuration");
    metadataCache.set(endpoint, promise);
  }
  return promise;
}

async function getJwks(jwksUri: string) {
  let promise = jwksCache.get(jwksUri);
  if (!promise) {
    promise = fetchJson<JsonWebKeySet>(jwksUri, "jwks");
    jwksCache.set(jwksUri, promise);
  }
  return promise;
}

async function fetchJson<T>(url: string, code: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json"
    }
  });
  if (!response.ok) {
    throw new ExternalServiceError(`Failed to fetch Entra ${code}.`, code);
  }
  return (await response.json()) as T;
}

function codeChallenge(verifier: string) {
  return base64UrlEncode(createHash("sha256").update(verifier).digest());
}

function randomToken(byteLength: number) {
  return base64UrlEncode(randomBytes(byteLength));
}

function safeReturnTo(value: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function stringClaim(claims: Record<string, unknown>, key: string) {
  const value = claims[key];
  return typeof value === "string" ? value : "";
}

function numberClaim(claims: Record<string, unknown>, key: string) {
  const value = claims[key];
  if (typeof value !== "number") {
    throw new ExternalServiceError(`The Entra ID token is missing numeric claim ${key}.`, "missing_claim");
  }
  return value;
}

function optionalNumberClaim(claims: Record<string, unknown>, key: string) {
  const value = claims[key];
  return typeof value === "number" ? value : undefined;
}

