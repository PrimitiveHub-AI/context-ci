import { T1PromptInjectionDetector } from "./t1-prompt-injection.js"
import { T2UnicodeSteganographyDetector } from "./t2-unicode-steganography.js"
import { T5UnsafeShellInstallDetector } from "./t5-unsafe-shell-install.js"
import { type Detector } from "./types.js"

/**
 * v0.1 detector roster — the launch-demo trifecta (T1 / T2 / T5).
 * Order is stable so `--json` output is reproducible.
 */
export const DETECTORS: readonly Detector[] = [
  new T1PromptInjectionDetector(),
  new T2UnicodeSteganographyDetector(),
  new T5UnsafeShellInstallDetector(),
]

export function detectorByName(name: string): Detector | undefined {
  return DETECTORS.find((d) => d.name === name || d.cciId === name || d.threatCategory === name)
}
