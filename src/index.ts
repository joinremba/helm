import type {
  ProviderConfig,
  HelmOptions,
  ResolvedHelmOptions,
  CompleteRequest,
  CompleteResponse,
  Message,
} from "./types";
import {
  ProviderConfigSchema,
  HelmOptionsSchema,
  CompleteRequestSchema,
  resolveHelmOptions,
} from "./types";
import type { Client } from "@joinremba/core";
import { PromptRegistry } from "./prompts";
import { ProviderClient } from "./providers";
import { parseModel } from "./utils";
import { AllModelsFailedError, HelmError } from "./errors";

export type * from "./types";
export * from "./errors";

export class Helm {
  private providers: Map<string, ProviderClient>;
  private prompts: PromptRegistry;
  private opts: ResolvedHelmOptions;
  private client?: Client;

  constructor(providers: Record<string, ProviderConfig>, options: HelmOptions = {}) {
    HelmOptionsSchema.parse(options);
    this.opts = resolveHelmOptions(options);
    this.client = options.client;

    this.providers = new Map();
    for (const [name, config] of Object.entries(providers)) {
      const validated = ProviderConfigSchema.parse(config);
      this.providers.set(name, new ProviderClient(name, validated, this.opts));
    }
    this.prompts = new PromptRegistry(options.prompts);

    if (this.client) {
      this.sync().catch(() => {});
    }
  }

  async sync(): Promise<void> {
    if (!this.client) return;
    try {
      const entries = await this.client.listPrompts();
      for (const entry of entries) {
        this.prompts.set(entry.name, entry.template);
      }
    } catch {
      // Silently fail — local prompts take precedence
    }
  }

  prompt(name: string, template: string): void;
  prompt(name: string): string | undefined;
  prompt(name: string, template?: string): string | undefined | void {
    if (template === undefined) {
      return this.prompts.get(name);
    }
    this.prompts.set(name, template);
    if (this.client) {
      this.client.upsertPrompt({ name, template }).catch(() => {});
    }
  }

  render(name: string, inputs: Record<string, string>): string {
    return this.prompts.render(name, inputs);
  }

  async complete(request: CompleteRequest): Promise<CompleteResponse> {
    const parsed = CompleteRequestSchema.parse(request);

    const messages = this.resolveMessages(parsed);

    const models = [parsed.model, ...(parsed.fallbacks ?? [])];
    const errors: { model: string; error: string }[] = [];

    for (const fullModel of models) {
      const { provider, modelId } = parseModel(fullModel);
      const client = this.providers.get(provider);
      if (client === undefined) {
        errors.push({ model: fullModel, error: `Provider "${provider}" is not configured` });
        continue;
      }

      try {
        const start = performance.now();
        const result = await client.complete(modelId, messages, {
          temperature: parsed.temperature,
          maxTokens: parsed.maxTokens,
          topP: parsed.topP,
          stop: parsed.stop,
          timeout: this.opts.timeout,
        });
        const latencyMs = performance.now() - start;
        return {
          content: result.content,
          model: fullModel,
          provider,
          usage: result.usage,
          latencyMs,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        errors.push({ model: fullModel, error: errorMessage });
      }
    }

    throw new AllModelsFailedError(parsed.model, parsed.fallbacks ?? [], errors);
  }

  private resolveMessages(req: CompleteRequest): Message[] {
    if (req.prompt !== undefined) {
      const content = this.prompts.render(req.prompt, req.inputs ?? {});
      return [{ role: "user", content }];
    }
    if (req.messages !== undefined && req.messages.length > 0) {
      return req.messages;
    }
    throw new HelmError("Either messages or prompt must be provided");
  }
}

export function createHelm(providers: Record<string, ProviderConfig>, options?: HelmOptions): Helm {
  return new Helm(providers, options);
}
