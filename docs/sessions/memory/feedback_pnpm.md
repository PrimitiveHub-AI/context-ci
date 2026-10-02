---
name: feedback-pnpm
description: "Always use pnpm for the PrimitiveHub project, never npm"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

Use pnpm for the PrimitiveHub project. Never run `npm install` or `npm run …`.

**Why:** The project ships `pnpm-lock.yaml`. Running npm creates a parallel `package-lock.json` and may resolve different transitive versions than pnpm did, leading to "works on my machine" drift. The user's AI assistant got this wrong in a setup prompt and I had to flag it.

**How to apply:** Any time the task involves installing deps, running scripts, or generating lockfiles in `/srv/primitivehub/app`, default to `pnpm`. If pnpm isn't installed in the current environment, ask before installing it — node/npm may not be present either.

Related: [[project-primitivehub]]
