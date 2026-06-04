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
export {
  runAudit,
  auditCommand,
  type AuditOptions,
} from "./commands/audit.js"
export { watchCommand, type WatchOptions } from "./commands/watch.js"
export {
  buildCbom,
  cbomCommand,
  renderCbom,
  serializeCbom,
  CBOM_FORMAT,
  CBOM_VERSION,
  CBOM_SCHEMA_URL,
  CBOM_TOOL_NAME,
  CBOM_TOOL_VERSION,
  CBOM_TOP_TEN_SPEC_VERSION,
  CBOM_TOP_TEN_DETECTOR_COUNT,
  type Cbom,
  type CbomComponent,
  type CbomSummary,
  type CbomOptions,
  type CbomCommandOptions,
  type CbomOutputFormat,
} from "./commands/cbom.js"
export {
  buildSpdxDocument,
  serializeSpdx,
  SPDX_VERSION,
  SPDX_DATA_LICENSE,
  type SpdxDocument,
} from "./cbom/spdx.js"
export {
  buildCycloneDxBom,
  serializeCycloneDxBom,
  CYCLONEDX_SPEC_VERSION,
  CYCLONEDX_BOM_FORMAT,
  type CycloneDxBom,
} from "./cbom/cyclonedx.js"
export {
  verifyBeforeLoad,
  type VerifyBeforeLoadOptions,
  type VerifyBeforeLoadResult,
  type VerifyBeforeLoadReason,
  type VerifyBeforeLoadReasonCode,
  type VerifyBeforeLoadChecks,
} from "./commands/verify-before-load.js"
export {
  startWatcher,
  type Watcher,
  type WatcherEvent,
  type WatcherOptions,
} from "./audit/watcher.js"
export {
  installCommand,
  runInstall,
  type InstallOptions,
  type InstallResult,
} from "./commands/install.js"
export {
  classifySource,
  fetchBundleText,
  parseSlugSemver,
  InstallSourceError,
  type BundleSource,
  type ResolveOptions,
} from "./install/source.js"
export {
  planInstallTarget,
  writeBundleContent,
  InstallWriteError,
  type BundleHeader,
  type InstallTarget,
} from "./install/writer.js"
export {
  type AuditResult,
  type AuditedArtifact,
  type AuditSummary,
} from "./audit/types.js"
export {
  classify,
  isTextScannable,
  ARTIFACT_CLASSES,
  type ArtifactClass,
} from "./audit/classifier.js"
export {
  walk,
  DEFAULT_WALK_OPTIONS,
  SKIP_DIRS,
  KEEP_DOT_DIRS,
  type WalkOptions,
  type WalkResult,
  type SkippedEntry,
  type SkipReason,
} from "./audit/walker.js"
export { sha256Hex, sha256Ref } from "./audit/digest.js"
export {
  diffLock,
  isLockDrifted,
  lockFromAudit,
  parseLock,
  readLock,
  serializeLock,
  writeLock,
  LockParseError,
  LOCK_VERSION,
  LOCK_TOP10_VERSION,
  LOCK_GENERATOR,
  LOCK_SCHEMA_URL,
  type LockAttestation,
  type LockDrift,
  type LockedArtifact,
  type PhubLock,
  type DiffAddedEntry,
  type DiffModifiedEntry,
  type DiffReclassifiedEntry,
  type DiffRemovedEntry,
} from "./audit/lock.js"
export { type AuditLockState } from "./audit/types.js"

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
export { T3EncodedPayloadsDetector } from "./scanners/t3-encoded-payloads.js"
export { T4RemoteFetchDetector } from "./scanners/t4-remote-fetch.js"
export { T5UnsafeShellInstallDetector } from "./scanners/t5-unsafe-shell-install.js"
export { T6CredentialExfiltrationDetector } from "./scanners/t6-credential-exfiltration.js"
export { T7PoisonedNamingDetector } from "./scanners/t7-poisoned-naming.js"
export { T8FakeCitationDetector } from "./scanners/t8-fake-citation.js"
export { T9CopyrightContaminationDetector } from "./scanners/t9-copyright-contamination.js"
export { T10ContextBloatDetector } from "./scanners/t10-context-bloat.js"

export { renderHumanScanReport, renderHumanVerifyReport } from "./reporters/human.js"
export { renderAuditHumanReport } from "./reporters/audit-human.js"
export { renderSarif, renderSarifForArtifacts } from "./reporters/sarif.js"

export {
  type Policy,
  type PolicyAllowEntry,
  type PolicyAllowRule,
  type PolicyRuleConfig,
  type PolicySeverity,
  IMPLICIT_DEFAULT_POLICY,
  PolicyLoadError,
} from "./policy/types.js"
export {
  loadPolicyFromString,
  loadPolicyFromFile,
  discoverPolicyPath,
  resolvePolicy,
} from "./policy/loader.js"
export {
  applyPolicy,
  type AllowedHint,
  type PolicyAdjustedVerdict,
  type PolicyEvaluation,
} from "./policy/evaluator.js"
export { matchGlob, matchAnyGlob } from "./policy/glob.js"
