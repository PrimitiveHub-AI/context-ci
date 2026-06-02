/**
 * @primitivehub/mcp-server — Model Context Protocol server exposing
 * PrimitiveHub verification + scanning to AI agents.
 *
 * Zero custom trust logic (Gate G-D acceptance criterion). Every
 * tool is a pure transport over an existing primitive:
 *
 *   verify_bundle    → @primitivehub/verify (ADR-0020)
 *   scan_text        → @primitivehub/phub runScan (ADR-0023)
 *   audit_workspace  → @primitivehub/phub runAudit (ADR-0025)
 *   check_lock       → @primitivehub/phub runAudit + lockMode:check (ADR-0026)
 *
 * If the verifier changes its behavior, the MCP server inherits it.
 * If the scanner roster expands (T3/T4/T6..T10), the MCP server
 * surfaces it automatically. The trust chain has one authoritative
 * implementation; this package is just a wire format.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

import { AUDIT_WORKSPACE_TOOL, callAuditWorkspace } from "./tools/audit-workspace.js"
import { CHECK_LOCK_TOOL, callCheckLock } from "./tools/check-lock.js"
import { SCAN_TEXT_TOOL, callScanText } from "./tools/scan-text.js"
import { VERIFY_BEFORE_LOAD_TOOL, callVerifyBeforeLoad } from "./tools/verify-before-load.js"
import { VERIFY_BUNDLE_TOOL, callVerifyBundle } from "./tools/verify-bundle.js"

export const SERVER_NAME = "primitivehub"
export const SERVER_VERSION = "0.1.0"

export const TOOLS = [
  VERIFY_BUNDLE_TOOL,
  SCAN_TEXT_TOOL,
  AUDIT_WORKSPACE_TOOL,
  CHECK_LOCK_TOOL,
  VERIFY_BEFORE_LOAD_TOOL,
] as const

/** Build a configured but not-yet-connected MCP server. */
export function buildServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS as unknown as Array<{
      name: string
      description: string
      inputSchema: object
    }>,
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params
    switch (name) {
      case "verify_bundle":
        return await callVerifyBundle(rawArgs)
      case "scan_text":
        return callScanText(rawArgs)
      case "audit_workspace":
        return callAuditWorkspace(rawArgs)
      case "check_lock":
        return callCheckLock(rawArgs)
      case "verify_before_load":
        return await callVerifyBeforeLoad(rawArgs)
      default:
        return {
          content: [
            { type: "text", text: JSON.stringify({ error: `unknown tool: ${name}` }, null, 2) },
          ],
          isError: true,
        }
    }
  })

  return server
}

/** Connect over stdio. Used by `bin/primitivehub-mcp.js`. */
export async function runStdio(): Promise<void> {
  const server = buildServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
