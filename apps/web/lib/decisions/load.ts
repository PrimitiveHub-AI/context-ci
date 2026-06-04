import { readFileSync } from "node:fs"
import { join } from "node:path"

import { findDocsRoot } from "../markdown/discovery"

export function readAdrSource(file: string): string {
  return readFileSync(join(findDocsRoot(), "decisions", file), "utf8")
}
