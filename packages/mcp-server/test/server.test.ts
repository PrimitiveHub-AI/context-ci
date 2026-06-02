/**
 * Server-level test: exercises `tools/list` and `tools/call` via the
 * MCP SDK's in-memory transport. Asserts that the JSON-RPC wire layer
 * advertises every tool we register and dispatches calls correctly.
 *
 * Stdio integration is tested ad-hoc via the bin (one-shot test in
 * the smoke-test workflow); this file covers the protocol-level
 * behavior without spawning a subprocess.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"

import { describe, expect, it } from "vitest"

import { buildServer, SERVER_NAME, SERVER_VERSION, TOOLS } from "../src/server.js"

async function connectInMemory(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = buildServer()
  const client = new Client(
    { name: "test-client", version: "0.0.0" },
    { capabilities: {} },
  )
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return client
}

describe("MCP server", () => {
  it("advertises name + version", () => {
    expect(SERVER_NAME).toBe("primitivehub")
    expect(SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })

  it("exposes all 5 v0.1 tools (post-ADR-0029)", () => {
    const names = TOOLS.map((t) => t.name).sort()
    expect(names).toEqual([
      "audit_workspace",
      "check_lock",
      "scan_text",
      "verify_before_load",
      "verify_bundle",
    ])
  })

  it("responds to tools/list with every registered tool + schema", async () => {
    const client = await connectInMemory()
    const result = await client.listTools()
    expect(result.tools.length).toBe(5)
    for (const tool of result.tools) {
      expect(typeof tool.name).toBe("string")
      expect(typeof tool.description).toBe("string")
      expect(typeof tool.inputSchema).toBe("object")
    }
    await client.close()
  })

  it("dispatches scan_text call end-to-end via JSON-RPC", async () => {
    const client = await connectInMemory()
    const res = await client.callTool({
      name: "scan_text",
      arguments: { content: "# clean\n", filename: "demo.md" },
    })
    expect(res.isError).toBe(false)
    const content = res.content as Array<{ type: string; text: string }>
    const payload = JSON.parse(content[0]!.text)
    expect(payload.exitCode).toBe(0)
    expect(payload.verdicts.length).toBe(3)
    await client.close()
  })

  it("dispatches verify_bundle call end-to-end via JSON-RPC", async () => {
    const client = await connectInMemory()
    // Pass a structurally-invalid bundle so we don't need a fixture path
    const res = await client.callTool({
      name: "verify_bundle",
      arguments: { bundle: "{}" },
    })
    expect(res.isError).toBe(true)
    const content = res.content as Array<{ type: string; text: string }>
    const payload = JSON.parse(content[0]!.text)
    expect(payload.valid).toBe(false)
    await client.close()
  })

  it("returns isError for an unknown tool name", async () => {
    const client = await connectInMemory()
    const res = await client.callTool({ name: "nonexistent_tool", arguments: {} })
    expect(res.isError).toBe(true)
    const content = res.content as Array<{ type: string; text: string }>
    const payload = JSON.parse(content[0]!.text)
    expect(payload.error).toMatch(/unknown tool/)
    await client.close()
  })
})
