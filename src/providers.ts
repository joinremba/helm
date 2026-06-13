import type {
  ProviderConfig,
  ProviderCallResult,
  CircuitBreakerState,
  ResolvedHelmOptions,
} from "./types";
import { ProviderRequestError, CircuitBreakerOpenError } from "./errors";

function noop(): void {}

export class ProviderClient {
  public readonly name: string;
  public readonly baseUrl: string;
  private readonly apiKey: string;
  private cbState: CircuitBreakerState = {
    failures: [],
    tripped: false,
    trippedAt: 0,
  };
  private readonly opts: ResolvedHelmOptions;

  constructor(name: string, config: ProviderConfig, opts: ResolvedHelmOptions) {
    this.name = name;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
    this.opts = opts;
  }

  async complete(
    modelId: string,
    messages: Array<{ role: string; content: string }>,
    params: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      stop?: string | string[];
      timeout: number;
    }
  ): Promise<ProviderCallResult> {
    this.checkCircuitBreaker();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.opts.retry.maxRetries; attempt++) {
      if (attempt > 0) {
        await this.sleep(this.opts.retry.backoffMs * Math.pow(2, attempt - 1));
      }

      try {
        const result = await this.executeRequest(modelId, messages, params);
        this.onSuccess();
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (err instanceof ProviderRequestError) {
          const shouldRetry = this.opts.retry.statusCodes.includes(err.statusCode ?? 0);
          if (!shouldRetry || attempt === this.opts.retry.maxRetries) {
            this.onFailure();
            throw lastError;
          }
        } else {
          // Non-retryable error (e.g., network timeout on last attempt)
          if (attempt === this.opts.retry.maxRetries) {
            this.onFailure();
            throw lastError;
          }
        }
      }
    }

    this.onFailure();
    throw lastError ?? new Error("Unknown error");
  }

  private async executeRequest(
    modelId: string,
    messages: Array<{ role: string; content: string }>,
    params: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
      stop?: string | string[];
      timeout: number;
    }
  ): Promise<ProviderCallResult> {
    const url = `${this.baseUrl}/chat/completions`;
    const body: Record<string, unknown> = {
      model: modelId,
      messages,
    };
    if (params.temperature !== undefined) body.temperature = params.temperature;
    if (params.maxTokens !== undefined) body.max_tokens = params.maxTokens;
    if (params.topP !== undefined) body.top_p = params.topP;
    if (params.stop !== undefined) body.stop = params.stop;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), params.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(noop);
        throw new ProviderRequestError(
          this.name,
          modelId,
          response.status,
          text || response.statusText
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const content = data.choices?.[0]?.message?.content;
      if (content === undefined || content === null) {
        throw new ProviderRequestError(this.name, modelId, undefined, "Empty response content");
      }

      const result: ProviderCallResult = { content };
      if (data.usage) {
        result.usage = {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        };
      }

      return result;
    } catch (err) {
      if (err instanceof ProviderRequestError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new ProviderRequestError(
          this.name,
          modelId,
          undefined,
          `Request timed out after ${params.timeout}ms`
        );
      }
      throw new ProviderRequestError(
        this.name,
        modelId,
        undefined,
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private checkCircuitBreaker(): void {
    if (!this.cbState.tripped) return;

    const elapsed = Date.now() - this.cbState.trippedAt;
    if (elapsed >= this.opts.circuitBreaker.cooldownMs) {
      this.cbState.tripped = false;
      this.cbState.failures = [];
      return;
    }

    throw new CircuitBreakerOpenError(this.name, this.opts.circuitBreaker.cooldownMs - elapsed);
  }

  private onSuccess(): void {
    this.cbState.failures = [];
    this.cbState.tripped = false;
  }

  private onFailure(): void {
    const now = Date.now();
    const windowStart = now - this.opts.circuitBreaker.windowMs;
    this.cbState.failures = this.cbState.failures.filter((ts) => ts > windowStart);
    this.cbState.failures.push(now);

    if (this.cbState.failures.length >= this.opts.circuitBreaker.threshold) {
      this.cbState.tripped = true;
      this.cbState.trippedAt = now;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
