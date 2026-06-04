import { readFileSync } from "node:fs"
import { join } from "node:path"

import { findDocsRoot } from "../markdown/discovery"

export interface SpecPage {
  slug: string
  title: string
  /** Filename in docs/ */
  file: string
  description: string
  order: number
  version: string
}

export const SPEC_PAGES: readonly SpecPage[] = [
  {
    slug: "trust-contract-v0.1",
    title: "Trust Contract v0.1",
    file: "trust-contract-v0.1.md",
    description:
      "The wire format. Subject + content + attestation, signed end-to-end. Media type, JSON Schema, in-toto Statement predicate, Sigstore signing model.",
    order: 1,
    version: "0.1",
  },
  {
    slug: "context-ci-top-10-v0.1",
    title: "Context CI Top 10 v0.1",
    file: "context-ci-top-10-v0.1.md",
    description:
      "The threat taxonomy. Ten categories CCI-001..CCI-010 with stable IDs, severity ranges, attack examples, detection approaches.",
    order: 2,
    version: "0.1",
  },
  {
    slug: "context-policy-v0.1",
    title: "Context Policy Language v0.1",
    file: "context-policy-v0.1.md",
    description:
      "The .primitivehub/policy.yaml format. Per-rule severity, per-file allow exceptions with required justification, glob path matching.",
    order: 3,
    version: "0.1",
  },
  {
    slug: "primitive-spec",
    title: "Primitive Spec",
    file: "spec.md",
    description:
      "The original primitive specification — frontmatter, body sections, content addressing, attestation predicate, signing model.",
    order: 4,
    version: "0.1",
  },
  {
    slug: "threat-model",
    title: "Threat Model",
    file: "threat-model.md",
    description:
      "The 10 supply-chain attack categories Context CI is designed to detect. Promoted to the Top 10 spec; retained for historical reference.",
    order: 5,
    version: "0.1",
  },
] as const

export function getSpecPage(slug: string): SpecPage | undefined {
  return SPEC_PAGES.find((p) => p.slug === slug)
}

export function readSpecSource(file: string): string {
  return readFileSync(join(findDocsRoot(), file), "utf8")
}
