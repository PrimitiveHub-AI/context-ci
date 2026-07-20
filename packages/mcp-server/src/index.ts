/**
 * Programmatic API surface.
 *
 * The primary distribution is the `primitivehub-mcp` binary
 * (`bin/primitivehub-mcp.js`) which connects over stdio. The exports
 * below let the server be embedded inline (e.g. for in-process tests
 * or alternative transports like SSE / HTTP that ship in v0.2+).
 */

export { buildServer, runStdio, SERVER_NAME, SERVER_VERSION, TOOLS } from "./server.js"
export { VERIFY_BUNDLE_TOOL, callVerifyBundle } from "./tools/verify-bundle.js"
export { SCAN_TEXT_TOOL, callScanText } from "./tools/scan-text.js"
export { AUDIT_WORKSPACE_TOOL, callAuditWorkspace } from "./tools/audit-workspace.js"
export { CHECK_LOCK_TOOL, callCheckLock } from "./tools/check-lock.js"
export { VERIFY_BEFORE_LOAD_TOOL, callVerifyBeforeLoad } from "./tools/verify-before-load.js"
