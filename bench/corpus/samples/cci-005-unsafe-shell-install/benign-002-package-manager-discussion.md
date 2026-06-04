# Frontend tooling overview

The project uses pnpm for JavaScript dependency management. Common
operations:

- Add a dependency:        pnpm add <pkg>
- Run a script:            pnpm run <name>
- Update lockfile:         pnpm install

The Python side uses `uv` for the same purpose. We do not use npm
directly; the lockfile discipline matters and mixed managers break
it.

For framework scaffolding, contributors should follow the framework's
own documented entry point. For example, shadcn/ui's documented
install command (`npx shadcn@latest add Button`) is the canonical
authoring flow — that's reference material, not an instruction
directed at the agent.
