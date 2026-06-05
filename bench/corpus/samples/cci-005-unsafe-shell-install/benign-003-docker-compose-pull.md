# Local deployment primitive

This primitive describes the local-dev workflow for PrimitiveHub.
The reader runs each command in their own shell; none of these
commands are invoked by an agent.

## Pull base images

```bash
docker compose pull
```

## Bring services up in detached mode

```bash
docker compose up -d
```

## View aggregated logs

```bash
docker compose logs -f --tail=200
```

All commands are read by the human operator from this document. The
agent neither parses nor executes them.
