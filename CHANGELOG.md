# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] — 2026-06-21

### Fixed

- `ProviderNotConfiguredError` is now actually thrown when a provider is not configured, matching documented API — was pushing a plain string

## [0.2.0] — 2026-06-14

### Added

- Cloud sync support: `client` option in `createHelm()` for remote prompt management via `@joinremba/core`
- Prompt upsert: `helm.prompt(name, template)` syncs to cloud when client is configured
- Prompt listing: `helm.sync()` fetches remote prompts on construction
- `@joinremba/core` dependency for cloud features

## [0.1.0] — 2026-06-12

### Added

- Initial release
- AI completion with provider failover chain
- Circuit breaker with rolling window and configurable thresholds
- Exponential backoff retry (429, 5xx)
- Prompt template management with variable interpolation
- Model string parsing (`provider/modelId` format)
- OpenAI-compatible provider client
- Retry and circuit breaker tests
