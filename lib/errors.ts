export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class ExternalServiceError extends Error {
  constructor(
    message: string,
    readonly causeCode?: string
  ) {
    super(message);
    this.name = "ExternalServiceError";
  }
}

export function isConfigurationError(error: unknown) {
  return error instanceof ConfigurationError;
}

export function sanitiseError(error: unknown) {
  if (error instanceof ConfigurationError) {
    return {
      code: "configuration_error",
      message: error.message
    };
  }

  if (error instanceof ExternalServiceError) {
    return {
      code: error.causeCode ?? "external_service_error",
      message: error.message
    };
  }

  return {
    code: "unexpected_error",
    message: "An unexpected error occurred while running the Phase 0 proof."
  };
}

export function errorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code ?? "unknown");
  }
  return "unknown";
}
