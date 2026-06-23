import { ConfigurationError } from "../errors";

export type AuthConfig = {
  authority: string;
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  tenantId: string;
};

export function getAuthConfig(): AuthConfig {
  const tenantId = required("ENTRA_TENANT_ID");
  return {
    authority: normaliseAuthority(process.env.ENTRA_AUTHORITY?.trim() || `https://login.microsoftonline.com/${tenantId}`),
    clientId: required("ENTRA_CLIENT_ID"),
    clientSecret: required("ENTRA_CLIENT_SECRET"),
    sessionSecret: required("AUTH_SESSION_SECRET"),
    tenantId
  };
}

export function getSessionSecret() {
  return required("AUTH_SESSION_SECRET");
}

export function getAuthRuntimeSummary() {
  return {
    entra_client_configured: has("ENTRA_CLIENT_ID"),
    entra_tenant_configured: has("ENTRA_TENANT_ID"),
    runtime_authentication: has("ENTRA_CLIENT_ID") && has("ENTRA_TENANT_ID"),
    session_secret_configured: has("AUTH_SESSION_SECRET")
  };
}

export function tokenEndpoint(config: AuthConfig) {
  return `${config.authority}/oauth2/v2.0/token`;
}

export function authorizeEndpoint(config: AuthConfig) {
  return `${config.authority}/oauth2/v2.0/authorize`;
}

export function metadataEndpoint(config: AuthConfig) {
  return `${config.authority}/v2.0/.well-known/openid-configuration`;
}

function normaliseAuthority(value: string) {
  return value.replace(/\/+$/, "");
}

function has(name: string) {
  return Boolean(process.env[name]?.trim());
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConfigurationError(`Missing required environment variable: ${name}`);
  }
  return value;
}

