---
name: feedback-containerize
description: "PrimitiveHub mandate — containerize everything via Docker, follow container best practices"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

Every PrimitiveHub service runs in a container. No exceptions, no host-installed dependencies in dev or prod. Frontend, backend, databases, cache, broker, workers, object storage, observability — all containerized.

**Why:** The user declared this MAJOR AND MANDATORY. PrimitiveHub is positioned as "GitHub Enterprise for AI Context Primitives" — its trust narrative collapses if the platform itself ships as a bag of ad-hoc host installs. Containerization is also the only sane path to dev/prod parity, multi-environment deploys (Hetzner / private enterprise / air-gapped), and the future enterprise self-host story.

**How to apply:**
- Local dev: `docker compose up` brings the full stack. Hot-reload via bind mounts for app code. Named volumes for state.
- Multi-stage builds for every app image (deps stage → builder stage → minimal runtime). Use Alpine/Distroless/slim base where possible.
- Non-root user inside every container. Pinned image tags (no `:latest`). `HEALTHCHECK` directives.
- Secrets via env files (gitignored) for dev; Docker secrets / external secret manager for prod.
- `.dockerignore` matched to each context to keep image layers small.
- One service per container. No "fat" containers running multiple processes.
- Production-target compose / orchestration uses same images as dev — only env, replicas, and resource limits differ.

**Mistakes to undo from this session:**
- I installed Node 24 + pnpm directly on the host via nvm to run `pnpm install / build`. That was expedient but wrong direction. Next iteration replaces it with a Node container + `docker compose up` workflow. The host's nvm/Node can stay for now but should not be required.

Related: [[project-primitivehub]], [[feedback-pnpm]]
