/**
 * Policy loader: parse YAML → validate against schema → apply
 * defaults → return Policy.
 */

import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"

import { parse as parseYaml } from "yaml"

import { POLICY_SCHEMA_V0_1, RESERVED_FIELDS } from "./schema-v0.1.js"
import { IMPLICIT_DEFAULT_POLICY, type Policy, PolicyLoadError } from "./types.js"
import { validateAgainstSchema } from "./validator.js"

const DEFAULT_POLICY_PATH = ".primitivehub/policy.yaml"

export function loadPolicyFromString(yamlText: string, source = "<inline>"): Policy {
  let parsed: unknown
  try {
    parsed = parseYaml(yamlText)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new PolicyLoadError(`YAML parse error: ${msg}`, source)
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new PolicyLoadError("policy root must be a YAML mapping", source)
  }

  // Reject reserved v0.2 fields with a forward-guiding message.
  const obj = parsed as Record<string, unknown>
  for (const reserved of RESERVED_FIELDS) {
    if (reserved.name in obj) {
      throw new PolicyLoadError(
        `field '${reserved.name}' is reserved for ${reserved.futurePurpose}; not supported in v0.1`,
        source,
      )
    }
  }

  // Schema-validate. Errors get joined into a single message so the
  // caller sees everything wrong with their policy at once.
  const errors = validateAgainstSchema(parsed, POLICY_SCHEMA_V0_1)
  if (errors.length > 0) {
    const lines = errors.map((e) => `  - ${e.path}: ${e.message}`).join("\n")
    throw new PolicyLoadError(`policy fails schema validation:\n${lines}`, source)
  }

  // Apply defaults per spec § 4.1.
  const policy: Policy = {
    version: "0.1",
    strict: typeof obj["strict"] === "boolean" ? obj["strict"] : false,
    rules: (obj["rules"] as Policy["rules"]) ?? {},
    allow: (obj["allow"] as Policy["allow"]) ?? [],
  }

  return policy
}

export function loadPolicyFromFile(path: string): Policy {
  if (!existsSync(path)) {
    throw new PolicyLoadError(`policy file not found: ${path}`, path)
  }
  let content: string
  try {
    content = readFileSync(path, "utf8")
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new PolicyLoadError(`cannot read policy file: ${msg}`, path)
  }
  return loadPolicyFromString(content, path)
}

/**
 * Discovery: walk from cwd up to git root looking for
 * `.primitivehub/policy.yaml`. Returns the path or null.
 */
export function discoverPolicyPath(startDir: string = process.cwd()): string | null {
  let cursor = resolve(startDir)
  for (let i = 0; i < 20; i++) {
    const candidate = join(cursor, DEFAULT_POLICY_PATH)
    if (existsSync(candidate)) return candidate
    if (existsSync(join(cursor, ".git"))) return null
    const parent = dirname(cursor)
    if (parent === cursor) return null
    cursor = parent
  }
  return null
}

/**
 * Resolve which policy to use: explicit path > discovered file >
 * implicit default. Throws PolicyLoadError on explicit-path failure.
 */
export function resolvePolicy(
  explicitPath: string | undefined,
  cwd: string = process.cwd(),
): { policy: Policy; source: string } {
  if (explicitPath !== undefined) {
    return { policy: loadPolicyFromFile(explicitPath), source: explicitPath }
  }
  const discovered = discoverPolicyPath(cwd)
  if (discovered !== null) {
    return { policy: loadPolicyFromFile(discovered), source: discovered }
  }
  return { policy: IMPLICIT_DEFAULT_POLICY, source: "<implicit-default>" }
}
