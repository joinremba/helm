# Contributing

## Development

```bash
bun install
bun run check    # lint + format:check + typecheck + test
```

## Pull Requests

1. Fork the repo
2. Create a feature branch
3. Run `bun run check` before pushing
4. Open a PR against `main`

## Guidelines

- Match existing code style (Prettier config)
- Write tests for new functionality
- Keep the public API minimal and intentional
- No `export default` — named exports only
