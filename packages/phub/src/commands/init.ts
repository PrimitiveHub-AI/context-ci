import { existsSync } from "node:fs"
import { join } from "node:path"

import { writeFileNoFollow, UnsafeWriteError } from "../fs/safe-write.js"

const STARTER_AGENTS_MD = `# AGENTS.md

> Context primitive for an AI coding agent (Claude, Codex, Cursor, …).
> Scan with \`npx phub scan AGENTS.md\` before committing.

## Project identity

<!-- One paragraph: what this project is, who it serves. Keep tight. -->

## Conventions

<!-- Coding conventions the agent must respect. Style, layout, naming. -->

## Hard rules

<!-- Things the agent MUST or MUST NOT do. Be specific. -->
`

export interface InitOptions {
  /** Overwrite an existing AGENTS.md without prompting */
  force: boolean
  /** Directory to write into (default: cwd) */
  cwd: string
}

export function initCommand(opts: InitOptions): number {
  const target = join(opts.cwd, "AGENTS.md")
  if (existsSync(target) && !opts.force) {
    process.stderr.write(
      `phub init: ${target} already exists. Pass --force to overwrite.\n`,
    )
    return 2
  }
  // SECURITY (SYM / CWE-59/61): a repo-committed `AGENTS.md` symlink (dangling
  // or live) must not redirect this write outside cwd. writeFileNoFollow
  // refuses a symlinked target and writes via O_EXCL.
  try {
    writeFileNoFollow(target, STARTER_AGENTS_MD, { overwrite: opts.force, root: opts.cwd })
  } catch (err) {
    if (err instanceof UnsafeWriteError) {
      process.stderr.write(`phub init: ${err.message}\n`)
      return 2
    }
    throw err
  }
  process.stdout.write(`Wrote ${target}\n`)
  process.stdout.write(
    `Next: edit it, then run \`npx phub scan AGENTS.md\` to check it against Context CI Top 10.\n`,
  )
  return 0
}
