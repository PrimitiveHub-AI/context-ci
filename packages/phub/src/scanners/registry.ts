import { T1PromptInjectionDetector } from "./t1-prompt-injection.js"
import { T2UnicodeSteganographyDetector } from "./t2-unicode-steganography.js"
import { T3EncodedPayloadsDetector } from "./t3-encoded-payloads.js"
import { T4RemoteFetchDetector } from "./t4-remote-fetch.js"
import { T5UnsafeShellInstallDetector } from "./t5-unsafe-shell-install.js"
import { T6CredentialExfiltrationDetector } from "./t6-credential-exfiltration.js"
import { type Detector } from "./types.js"

/**
 * Active detector roster — six of the ten Context CI Top 10 v0.1
 * categories shipped.
 *
 *   T1 prompt injection            (CCI-001)  — launch demo
 *   T2 Unicode steganography       (CCI-002)  — launch demo
 *   T3 encoded payloads            (CCI-003)  — PR 5.6
 *   T4 remote fetch at load        (CCI-004)  — PR 5.6
 *   T5 unsafe shell install        (CCI-005)  — launch demo
 *   T6 credential exfiltration     (CCI-006)  — PR 5.6
 *
 * Stable category-number order so `--json` output is reproducible.
 * Adding a new detector = one import + one array entry, lockstep
 * with the Python registry (apps/api/scanners/registry.py) per
 * ADR-0023.
 */
export const DETECTORS: readonly Detector[] = [
  new T1PromptInjectionDetector(),
  new T2UnicodeSteganographyDetector(),
  new T3EncodedPayloadsDetector(),
  new T4RemoteFetchDetector(),
  new T5UnsafeShellInstallDetector(),
  new T6CredentialExfiltrationDetector(),
]

export function detectorByName(name: string): Detector | undefined {
  return DETECTORS.find((d) => d.name === name || d.cciId === name || d.threatCategory === name)
}
