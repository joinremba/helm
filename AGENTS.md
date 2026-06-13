## Commands

```bash
bun test                  # Run all tests
bun run typecheck         # TypeScript check (tsc --noEmit)
bun run format            # Prettier
bun run lint              # ESLint
bun run check             # All checks: lint + format:check + typecheck + test
```

## Architecture

- **`@joinremba/helm`** — AI stack orchestrator with provider failover, circuit breaker, and prompt template management.
- **`src/index.ts`** — `createHelm(providers, options?)` → returns `Helm` with `complete()`, `prompt()`, `render()`.
- **`src/types.ts`** — Zod schemas + TS types for `ProviderConfig`, `HelmOptions`, `CompleteRequest`, `CompleteResponse`, `CircuitBreakerState`.
- **`src/errors.ts`** — `HelmError`, `AllModelsFailedError`, `ProviderNotConfiguredError`, `CircuitBreakerOpenError`, `PromptNotFoundError`, `MissingPromptInputError`, `ProviderRequestError`.
- **`src/prompts.ts`** — `PromptRegistry` class: in-memory template store with `set/get/render/has/entries/clear`.
- **`src/providers.ts`** — `ProviderClient` class: OpenAI-compatible HTTP client with retry (exponential backoff) and circuit breaker (rolling window).
- **`src/utils.ts`** — `parseModel()`: parses `"provider/model"` into `{ provider, modelId }`.

## Patterns

- **Named exports only** (no `export default`). `createHelm` is the factory function.
- **Model string format**: `{provider}/{modelId}` — e.g. `groq/llama-3.1-8b-instant`.
- **Prompt templates**: Use `{variableName}` syntax. Register via `helm.prompt(name, template)`, render via `helm.render(name, inputs)`.
- **Failover chain**: `complete()` tries primary model, then each fallback in order. Skips unconfigured providers. Throws `AllModelsFailedError` when all fail.
- **Circuit breaker**: Tracks failures in a rolling window. When threshold is hit, provider is skipped (throws `CircuitBreakerOpenError`). Resets after cooldown.
- **Retry**: Exponential backoff (1s, 2s, 4s...) on configured status codes (429, 5xx).
- **Env cleanup**: Tests restore `globalThis.fetch` in `afterEach` to prevent cross-test pollution.
