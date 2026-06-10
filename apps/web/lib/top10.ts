/**
 * Context CI Top 10 — taxonomy data for the visual /top-10 page.
 *
 * Source of truth: docs/context-ci-top-10-v0.1.md (the normative
 * spec). This file extracts the card-renderable shape — severity
 * ceiling, detector implementation, canonical sample path — and
 * leaves the full prose at /specs/context-ci-top-10-v0.1.
 *
 * Discipline: the per-detector measured F1 is NOT hardcoded here.
 * It is read live from `lib/evaluation.ts` (the embedded baseline
 * snapshot) at render time. Hardcoding it would let it drift from
 * the corpus regression gate — exactly the failure mode the
 * <EvaluationLink> + sync-evaluation.mjs pipeline exists to prevent.
 *
 * Order: stable CCI-001..CCI-010 per ADR-0016 (Top 10 taxonomy
 * versioning). Append-only — IDs are never reused.
 */

const GH_BLOB = "https://github.com/DevXYZx/primitivehub/blob/main"

/** Maximum severity a detector may emit. From the spec § 3 severity model. */
export type SeverityMax = "warn" | "fail"

export interface Top10Entry {
  readonly cci: string
  /** Human name from the spec heading, trimmed for card display. */
  readonly name: string
  /** One-line definition rendered in the card body. */
  readonly definition: string
  /**
   * Severity ceiling — the worst verdict the detector emits. CCI-010
   * is the only entry that maxes at "warn"; the other nine can FAIL.
   */
  readonly severityMax: SeverityMax
  /** Detector module name + current shipping version. */
  readonly detector: string
  readonly detectorVersion: string
  /**
   * Canonical adversarial sample — the lowest-numbered adversarial
   * fixture for the category. Cite this when illustrating the attack
   * shape. Path is relative to repo root.
   */
  readonly canonicalSample: string
  readonly canonicalSamplePath: string
}

const ENTRIES: readonly Top10Entry[] = [
  {
    cci: "CCI-001",
    name: "Prompt Injection in Markdown",
    definition:
      "Hidden imperative override that hijacks the agent's instruction-following loop.",
    severityMax: "fail",
    detector: "t1.prompt_injection",
    detectorVersion: "v0.2.1",
    canonicalSample: "S-001",
    canonicalSamplePath:
      "bench/corpus/samples/cci-001-prompt-injection/adversarial-001-classic.md",
  },
  {
    cci: "CCI-002",
    name: "Hidden Unicode Steganography",
    definition:
      "Tag-character payloads invisible to the eye but tokenized by the model.",
    severityMax: "fail",
    detector: "t2.unicode_steganography",
    detectorVersion: "v0.2.0",
    canonicalSample: "S-006",
    canonicalSamplePath:
      "bench/corpus/samples/cci-002-unicode-steganography/adversarial-001-zwsp.md",
  },
  {
    cci: "CCI-003",
    name: "Encoded Payloads",
    definition:
      "Base64 / hex / URL-encoded instructions paired with a decode-and-run directive.",
    severityMax: "fail",
    detector: "t3.encoded_payloads",
    detectorVersion: "v0.2.3",
    canonicalSample: "S-019",
    canonicalSamplePath:
      "bench/corpus/samples/cci-003-encoded-payloads/adversarial-001-base64-decode-run.md",
  },
  {
    cci: "CCI-004",
    name: "Remote Content Fetch at Load Time",
    definition:
      "Load-time `curl` / `wget` / `wss://` directives that pull untrusted bytes into context.",
    severityMax: "fail",
    detector: "t4.remote_fetch",
    detectorVersion: "v0.2.2",
    canonicalSample: "S-029",
    canonicalSamplePath:
      "bench/corpus/samples/cci-004-remote-fetch/adversarial-001-fetch-and-include.md",
  },
  {
    cci: "CCI-005",
    name: "Unsafe Shell / npx Install",
    definition: "`curl URL | bash` and friends — the Shai-Hulud / Codecov-2021 vector.",
    severityMax: "fail",
    detector: "t5.unsafe_shell_install",
    detectorVersion: "v0.2.7",
    canonicalSample: "S-010",
    canonicalSamplePath:
      "bench/corpus/samples/cci-005-unsafe-shell-install/adversarial-001-curl-pipe-bash.md",
  },
  {
    cci: "CCI-006",
    name: "Credential Exfiltration via Prose",
    definition:
      "Instructions to read `.env` / `~/.ssh` / cloud keys and post them to an attacker URL.",
    severityMax: "fail",
    detector: "t6.credential_exfiltration",
    detectorVersion: "v0.2.0",
    canonicalSample: "S-039",
    canonicalSamplePath:
      "bench/corpus/samples/cci-006-credential-exfiltration/adversarial-001-send-env-to-url.md",
  },
  {
    cci: "CCI-007",
    name: "Poisoned Naming · Typosquat · Impersonation",
    definition:
      "Vendor homoglyphs and false-affiliation phrases (“the official Anthropic primitive”).",
    severityMax: "fail",
    detector: "t7.poisoned_naming",
    detectorVersion: "v0.3.2",
    canonicalSample: "S-059",
    canonicalSamplePath:
      "bench/corpus/samples/cci-007-poisoned-naming/adversarial-001-official-anthropic.md",
  },
  {
    cci: "CCI-008",
    name: "Fake Citations / Fabricated Authority",
    definition:
      "Manufactured CVEs, RFCs, patents, and standards-compliance claims with no referent.",
    severityMax: "fail",
    detector: "t8.fake_citation",
    detectorVersion: "v0.2.3",
    canonicalSample: "S-049",
    canonicalSamplePath:
      "bench/corpus/samples/cci-008-fake-citation/adversarial-001-invalid-cve.md",
  },
  {
    cci: "CCI-009",
    name: "Copyright Contamination",
    definition:
      "License-laundering via inlined MIT / GPL / CC-BY boilerplate hijacking primitive text.",
    severityMax: "fail",
    detector: "t9.copyright_contamination",
    detectorVersion: "v0.2.3",
    canonicalSample: "S-068",
    canonicalSamplePath:
      "bench/corpus/samples/cci-009-copyright-contamination/adversarial-001-mit-boilerplate.md",
  },
  {
    cci: "CCI-010",
    name: "Context Bloat",
    definition:
      "Oversized primitives that burn token budget and bury real instructions in noise.",
    severityMax: "warn",
    detector: "t10.context_bloat",
    detectorVersion: "v0.1.2",
    canonicalSample: "S-078",
    canonicalSamplePath:
      "bench/corpus/samples/cci-010-context-bloat/primitives/adversarial-001-oversized.md",
  },
] as const

export function listTop10(): readonly Top10Entry[] {
  return ENTRIES
}

/** Build a GitHub-blob URL for a path relative to the repo root. */
export function ghBlob(path: string): string {
  return `${GH_BLOB}/${path}`
}
