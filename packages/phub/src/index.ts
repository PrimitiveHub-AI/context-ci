/**
 * phub — programmatic API surface.
 *
 * The primary distribution of this package is the `phub` CLI binary
 * (`bin/phub.js`). The exports below let the scanners + commands be
 * embedded in other tools (e.g. a custom GitHub Action that wants
 * SARIF output, or a pre-commit hook that runs scan in-process).
 */

export { main } from "./cli.js"

export { runScan, scanCommand, type ScanOptions, type ScanResult } from "./commands/scan.js"
export { verifyCommand, type VerifyOptions } from "./commands/verify.js"
export { initCommand, type InitOptions } from "./commands/init.js"

export { DETECTORS, detectorByName } from "./scanners/registry.js"
export {
  type Detector,
  type DetectorContext,
  type DiffHint,
  type Verdict,
  Severity,
  MAX_HINTS_PER_VERDICT,
  SNIPPET_MAX_CHARS,
} from "./scanners/types.js"

export { T1PromptInjectionDetector } from "./scanners/t1-prompt-injection.js"
export { T2UnicodeSteganographyDetector } from "./scanners/t2-unicode-steganography.js"
export { T5UnsafeShellInstallDetector } from "./scanners/t5-unsafe-shell-install.js"

export { renderHumanScanReport, renderHumanVerifyReport } from "./reporters/human.js"
