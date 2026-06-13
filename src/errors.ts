export class HelmError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "HelmError";
  }
}

export class AllModelsFailedError extends HelmError {
  public readonly errors: { model: string; error: string }[];
  public readonly model: string;
  public readonly fallbacks: string[];

  constructor(model: string, fallbacks: string[], errors: { model: string; error: string }[]) {
    const summary =
      errors.length > 0
        ? errors.map((e) => `  » ${e.model}: ${e.error}`).join("\n")
        : "  (no providers attempted)";
    super(`All models failed:\n${summary}`);
    this.name = "AllModelsFailedError";
    this.model = model;
    this.fallbacks = fallbacks;
    this.errors = errors;
  }
}

export class ProviderNotConfiguredError extends HelmError {
  constructor(provider: string) {
    super(`Provider "${provider}" is not configured`);
    this.name = "ProviderNotConfiguredError";
  }
}

export class CircuitBreakerOpenError extends HelmError {
  constructor(
    public readonly provider: string,
    cooldownRemainingMs: number
  ) {
    super(`Circuit breaker open for "${provider}", retry in ${Math.ceil(cooldownRemainingMs)}ms`);
    this.name = "CircuitBreakerOpenError";
  }
}

export class PromptNotFoundError extends HelmError {
  constructor(name: string) {
    super(`Prompt template "${name}" not found`);
    this.name = "PromptNotFoundError";
  }
}

export class MissingPromptInputError extends HelmError {
  constructor(key: string, name: string) {
    super(`Missing input "${key}" for prompt template "${name}"`);
    this.name = "MissingPromptInputError";
  }
}

export class ProviderRequestError extends HelmError {
  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly statusCode: number | undefined,
    message: string
  ) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderRequestError";
  }
}
