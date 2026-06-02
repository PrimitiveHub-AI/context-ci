/**
 * Minimal hand-rolled argv parser. Zero deps. Sufficient for phub v0.1's
 * three subcommands (scan / verify / init) + global flags.
 *
 * Supports:
 *   --flag                    boolean flag
 *   --flag=value              string flag with value
 *   --flag value              string flag with separate value
 *   -f                        single-letter alias
 *   --                        end of options; rest are positional
 *
 * Does NOT support: grouped short flags (-abc), counted flags (-vvv).
 * The CLI surface is small enough that those aren't needed.
 */

export interface ParsedArgs {
  command: string
  positionals: string[]
  flags: Record<string, string | boolean | string[]>
}

export interface FlagSpec {
  /** Long flag name without `--` */
  name: string
  /** Optional single-letter alias */
  alias?: string
  /** If true, the flag takes a string value */
  takesValue?: boolean
  /** If true, multiple occurrences accumulate to an array */
  multiple?: boolean
}

const HELP_TEXT_PER_COMMAND = "Run `phub help <command>` for command-specific options."

export function parseArgs(argv: readonly string[], specs: readonly FlagSpec[]): ParsedArgs {
  // argv excludes node + script — caller passes process.argv.slice(2).
  const aliasMap = new Map<string, FlagSpec>()
  const specByName = new Map<string, FlagSpec>()
  for (const spec of specs) {
    specByName.set(spec.name, spec)
    if (spec.alias) aliasMap.set(spec.alias, spec)
  }

  let command = ""
  const positionals: string[] = []
  const flags: Record<string, string | boolean | string[]> = {}
  let endOfFlags = false

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]
    if (tok === undefined) continue

    if (endOfFlags) {
      if (command === "") command = tok
      else positionals.push(tok)
      continue
    }

    if (tok === "--") {
      endOfFlags = true
      continue
    }

    if (tok.startsWith("--")) {
      const eq = tok.indexOf("=")
      const name = eq === -1 ? tok.slice(2) : tok.slice(2, eq)
      const spec = specByName.get(name)
      if (!spec) {
        // Unknown long flag — store as boolean true so `phub help` etc still work.
        flags[name] = true
        continue
      }
      if (spec.takesValue) {
        const value = eq === -1 ? argv[++i] : tok.slice(eq + 1)
        if (value === undefined) {
          throw new UsageError(`flag --${name} requires a value`)
        }
        if (spec.multiple) {
          const prev = flags[spec.name]
          if (Array.isArray(prev)) prev.push(value)
          else flags[spec.name] = [value]
        } else {
          flags[spec.name] = value
        }
      } else {
        flags[spec.name] = true
      }
      continue
    }

    if (tok.startsWith("-") && tok.length > 1) {
      const alias = tok.slice(1)
      const spec = aliasMap.get(alias)
      if (!spec) {
        flags[alias] = true
        continue
      }
      if (spec.takesValue) {
        const value = argv[++i]
        if (value === undefined) {
          throw new UsageError(`flag -${alias} requires a value`)
        }
        flags[spec.name] = value
      } else {
        flags[spec.name] = true
      }
      continue
    }

    if (command === "") command = tok
    else positionals.push(tok)
  }

  return { command, positionals, flags }
}

export class UsageError extends Error {
  constructor(message: string) {
    super(`${message}\n${HELP_TEXT_PER_COMMAND}`)
    this.name = "UsageError"
  }
}
