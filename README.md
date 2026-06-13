# @joinremba/helm

AI stack orchestrator for Bun — provider failover, circuit breaker, retry, and prompt template management.

```ts
import { createHelm } from "@joinremba/helm";

const helm = createHelm({
  groq: { apiKey: process.env.GROQ_API_KEY },
  nvidia: { apiKey: process.env.NVIDIA_API_KEY },
  openai: { apiKey: process.env.OPENAI_API_KEY },
});

helm.prompt("translate", "Translate this to {language}: {text}");

const result = await helm.complete({
  model: "groq/llama-3.1-8b-instant",
  prompt: "translate",
  inputs: { language: "French", text: "Hello, how are you?" },
  fallbacks: ["nvidia/llama-3.1-8b-instruct", "openai/gpt-4o-mini"],
});

console.log(result.content); // "Bonjour, comment allez-vous ?"
```

## Features

- **Provider failover** — try primary, then fallbacks in order
- **Circuit breaker** — stop hammering a failing provider
- **Exponential backoff** — retry on 429/5xx
- **Prompt templates** — `{variable}` syntax with validation
- **Bun-first** — zero Node.js deps, uses `fetch` natively

## Installation

```bash
bun add @joinremba/helm
```

## Usage

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
helm.prompt("classify", "Classify this transaction as fraud or legitimate: {description}");
helm.prompt("summarize", "Summarize: {text}");
```

### 3. Complete with auto-failover

```ts
const response = await helm.complete({
  model: "groq/llama-3.1-8b-instant",
  prompt: "classify",
  inputs: { description: "Transfer of 500,000 NGN to unknown account" },
  fallbacks: ["nvidia/llama-3.1-8b-instruct", "openai/gpt-4o-mini"],
});
```

Or use raw messages:

```ts
const response = await helm.complete({
  model: "groq/llama-3.1-8b-instant",
  messages: [{ role: "user", content: "What is 2+2?" }],
});
```

### 4. Render templates without API call

```ts
const text = helm.render("classify", { description: "ATM withdrawal" });
// "Classify this transaction as fraud or legitimate: ATM withdrawal"
```

## Options

```ts
const helm = createHelm(providers, {
  timeout: 30_000,            // Request timeout in ms
  prompts: { ... },           // Initial prompt templates
  retry: {
    maxRetries: 2,            // Times to retry per model
    statusCodes: [429, 500, 502, 503, 504],
    backoffMs: 1000,          // Base backoff (doubles each attempt)
  },
  circuitBreaker: {
    threshold: 5,             // Failures before tripping
    cooldownMs: 30_000,       // How long to stay open
    windowMs: 60_000,         // Rolling window
  },
});
```

## API

### `Helm`

| Method     | Signature                                                          | Description                           |
| ---------- | ------------------------------------------------------------------ | ------------------------------------- |
| `complete` | `(req: CompleteRequest) => Promise<CompleteResponse>`              | Send completion with auto-failover    |
| `prompt`   | `(name: string, template?: string) => void \| string \| undefined` | Register or retrieve a template       |
| `render`   | `(name: string, inputs: Record<string, string>) => string`         | Render a template without calling API |

### `CompleteResponse`

```ts
{
  content: string;
  model: string;       // "groq/llama-3.1-8b-instant"
  provider: string;    // "groq"
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}
```

## Errors

| Error                        | Condition                               |
| ---------------------------- | --------------------------------------- |
| `AllModelsFailedError`       | All models (primary + fallbacks) failed |
| `CircuitBreakerOpenError`    | Provider is cooling down                |
| `ProviderNotConfiguredError` | Unknown provider in model string        |
| `PromptNotFoundError`        | Template not found                      |
| `MissingPromptInputError`    | Template variable missing               |
| `ProviderRequestError`       | HTTP error from provider                |

## License

MIT
