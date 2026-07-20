import { readFileSync } from "node:fs"

import { verifyBundle, type VerificationLevel } from "@primitivehub/verify"

import { renderHumanVerifyReport } from "../reporters/human.js"

export interface VerifyOptions {
  level: VerificationLevel
  strict: boolean
  allowFailFor: readonly string[]
  json: boolean
}

export async function verifyCommand(filename: string, opts: VerifyOptions): Promise<number> {
  let raw: string
  try {
    raw = readFileSync(filename, "utf8")
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`phub verify: cannot read ${filename}: ${msg}\n`)
    return 2
  }

  let bundle: unknown
  try {
    bundle = JSON.parse(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`phub verify: ${filename} is not valid JSON: ${msg}\n`)
    return 2
  }

  const result = await verifyBundle(bundle, {
    level: opts.level,
    policy: {
      strict: opts.strict,
      allowFailFor: opts.allowFailFor,
    },
  })

  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n")
  } else {
    process.stdout.write(renderHumanVerifyReport(filename, result) + "\n")
  }

  return result.valid ? 0 : 1
}
