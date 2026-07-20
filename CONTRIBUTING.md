# Contributing to Context CI

Thanks for helping make AI-agent context verifiable.

## The two highest-value contributions

1. **A missed attack** the scanner *should* catch (a false negative) — open
   a PR adding a labeled sample. See [SECURITY.md](SECURITY.md).
2. **A false positive** on a real, benign primitive — open a PR with a
   minimal reproducer.

Both feed the adversarial corpus that keeps every detector's precision and
recall honest.

## Packages

This repo holds four independent, MIT-licensed artifacts:

| Package | Build order |
|---|---|
| `packages/verify` | 1st (zero deps) |
| `packages/phub` | 2nd (uses verify) |
| `packages/mcp-server` | 3rd (uses verify + phub) |
| `actions/phub-scan` | composite GitHub Action |

```bash
cd packages/<pkg>
pnpm install
pnpm typecheck && pnpm test && pnpm build
```

Use **pnpm**, not npm. Tests must pass before a PR is reviewable.

## Trust logic lives in one place

`@primitivehub/verify` is the reference implementation of the Trust
Contract. The CLI, MCP server, and Action are *transports* — they call
verify, they do not re-implement trust decisions. PRs that add
trust/validation logic outside `verify` will be asked to move it.

## License

By contributing you agree your contribution is licensed under MIT.
