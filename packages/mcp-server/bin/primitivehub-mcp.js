#!/usr/bin/env node
import { runStdio } from "../dist/server.js"

runStdio().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err))
  process.exit(1)
})
