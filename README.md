# @joinremba/helm

AI stack orchestrator for Bun — provider failover, circuit breaker, retry, and prompt template management.

```ts
import { createHelm } from "@joinremba/helm";

const helm = createHelm({
  groq: { apiKey: process.env.GROQ_API_KEY },
  nvidia: { apiKey: process.env.NVIDIA_API_KEY },
});

helm.prompt("translate", "Translate to {language}: {text}");

const result = await helm.complete({
  model: "groq/llama-3.1-8b-instant",
  prompt: "translate",
  inputs: { language: "French", text: "Hello" },
  fallbacks: ["nvidia/llama-3.1-8b-instruct"],
});

console.log(result.content); // "Bonjour"
```

## Features

- **Provider failover** — try primary, then fallbacks in order
- **Circuit breaker** — stop hammering a failing provider
- **Exponential backoff** — retry on 429/5xx
- **Prompt templates** — `{variable}` syntax with validation
- **Cloud sync** — optionally sync prompts with Nexus via `@joinremba/core` client
- **Bun-first** — zero Node.js deps, uses `fetch` natively

## Installation

```bash
bun add @joinremba/helm
```

## Quick Start

### 1. Configure providers

```ts
import { createHelm } from "@joinremba/helm";

const helm = createHelm({
  groq: { apiKey: "gsk_..." },
  nvidia: { apiKey: "nvapi-..." },
  openai: { apiKey: "sk-...", baseUrl: "https://api.openai.com/v1" },
});
```

### 2. Register prompt templates

```ts
helm.prompt("classify", "Classify this transaction: {description}");
helm.prompt("summarize", "Summarize: {text}");
```

### 3. Complete with auto-failover

```ts
const response = await helm.complete({
  model: "groq/llama-3.1-8b-instant",
  prompt: "classify",
  inputs: { description: "Transfer of 500,000 NGN" },
  fallbacks: ["nvidia/llama-3.1-8b-instruct"],
});
```

Or use raw messages:

```ts
const response = await helm.complete({
  model: "groq/llama-3.1-8b-instant",
  messages: [{ role: "user", content: "What is 2+2?" }],
});
```

### 4. Render templates locally

```ts
const text = helm.render("classify", { description: "ATM withdrawal" });
// "Classify this transaction: ATM withdrawal"
```

## Cloud Sync (Nexus)

Helm can optionally sync prompts with a Nexus backend. Pass a `@joinremba/core` client to `createHelm()`:

```ts
import { createClient } from "@joinremba/core";
import { createHelm } from "@joinremba/helm";

const client = createClient({ apiKey: "remba_..." });

const helm = createHelm(providers, { client });
```

On construction, helm fetches all prompts from Nexus and loads them into its local registry. When you call `helm.prompt(name, template)`, it updates the local registry immediately (offline-first) and fires a background upsert to Nexus.

### Sync lifecycle

- **Init**: `helm.sync()` is called automatically in the constructor — pulls all prompts from Nexus
- **Set**: `helm.prompt(name, template)` updates local state immediately, pushes to Nexus in background
- **Manual sync**: Call `await helm.sync()` to re-pull from Nexus at any time

### Error handling

Cloud sync failures are silently caught — your local prompt state is never affected by a network issue.

## Options

```ts
const helm = createHelm(providers, {
  client,                          // @joinremba/core Client for Nexus sync
  timeout: 30_000,                 // Request timeout in ms
  prompts: {                       // Initial prompt templates
    greet: "Hello {name}!",
  },
  retry: {
    maxRetries: 2,                 // Times to retry per model
    statusCodes: [429, 500, 502, 503, 504],
    backoffMs: 1000,               // Base backoff (doubles each attempt)
  },
  circuitBreaker: {
    threshold: 5,                  // Failures before tripping
    cooldownMs: 30_000,            // How long to stay open
    windowMs: 60_000,              // Rolling window
  },
});
```

## API

### `createHelm(providers, options?)`

| Param       | Type                                      | Description              |
| ----------- | ----------------------------------------- | ------------------------ |
| `providers` | `Record<string, ProviderConfig>`           | Provider name → config   |
| `options`   | `HelmOptions`                             | Timeout, retry, CB, sync |

### `Helm`

| Method     | Signature                                                               | Description                           |
| ---------- | ----------------------------------------------------------------------- | ------------------------------------- |
| `complete` | `(req: CompleteRequest) => Promise<CompleteResponse>`                   | Send completion with auto-failover    |
| `prompt`   | `(name: string, template?: string) => void \| string \| undefined`      | Register or retrieve a template       |
| `render`   | `(name: string, inputs: Record<string, string>) => string`              | Render a template without API call    |
| `sync`     | `() => Promise<void>`                                                   | Pull prompts from Nexus (if client)   |

### `CompleteRequest`

```ts
{
  model: string;                           // "groq/llama-3.1-8b-instant"
  messages?: Message[];                    // Raw messages
  prompt?: string;                         // Named prompt template
  inputs?: Record<string, string>;         // Template variables
  fallbacks?: string[];                    // Fallback models
  temperature?: number;                    // 0-2
  maxTokens?: number;                      // Max completion tokens
  topP?: number;                           // 0-1
  stop?: string | string[];                // Stop sequences
}
```

### `CompleteResponse`

```ts
{
  content: string;
  model: string;       // The model that responded
  provider: string;    // The provider that responded
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}
```

### Model format

Models use the format `provider/model-id`:

```
groq/llama-3.1-8b-instant
nvidia/llama-3.1-8b-instruct
openai/gpt-4o-mini
```

The provider must match a key in the providers config passed to `createHelm`.

## Errors

| Error                        | Condition                               |
| ---------------------------- | --------------------------------------- |
| `AllModelsFailedError`       | All models (primary + fallbacks) failed |
| `CircuitBreakerOpenError`    | Provider circuit breaker is open        |
| `ProviderNotConfiguredError` | Provider in model string not configured |
| `PromptNotFoundError`        | Template name not found                 |
| `MissingPromptInputError`    | `{variable}` in template has no input   |
| `ProviderRequestError`       | HTTP error from the provider API        |
| `HelmError`                  | Generic validation error                |

## License

MIT
