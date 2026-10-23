/**
 * verify v0.2 Phase 1 — in-toto Statement binding (R09/R10).
 * The signature (Phase 2) is over the Statement; these assert the Statement
 * actually attests to THIS content under an allowed predicate.
 */
import { describe, expect, it } from "vitest"

import { verifyStatementBinding, ALLOWED_PREDICATE_TYPES } from "../src/statement.js"

const DIGEST = "a".repeat(64)
const PRED = [...ALLOWED_PREDICATE_TYPES][0]!

const b64 = (obj: unknown): string => Buffer.from(JSON.stringify(obj)).toString("base64")
const statement = (digest = DIGEST, predicateType = PRED) => ({
  _type: "https://in-toto.io/Statement/v1",
  subject: [{ name: "primitive", digest: { sha256: digest } }],
  predicateType,
  predicate: {},
})

describe("verifyStatementBinding — R09/R10", () => {
  it("a valid, bound statement under an allowed predicate → no failures", () => {
    expect(verifyStatementBinding(b64(statement()), DIGEST, PRED)).toEqual([])
  })

  it("case-insensitive subject digest match still binds", () => {
    expect(verifyStatementBinding(b64(statement(DIGEST.toUpperCase())), DIGEST, PRED)).toEqual([])
  })

  it("R10: subject digest != content digest → STATEMENT_SUBJECT_MISMATCH", () => {
    const f = verifyStatementBinding(b64(statement("b".repeat(64))), DIGEST, PRED)
    expect(f[0]?.code).toBe("STATEMENT_SUBJECT_MISMATCH")
  })

  it("R09: predicateType not in the allow-list → STATEMENT_PREDICATE_TYPE_MISMATCH", () => {
    const bad = "https://evil.example/predicate/v1"
    const f = verifyStatementBinding(b64(statement(DIGEST, bad)), DIGEST, bad)
    expect(f[0]?.code).toBe("STATEMENT_PREDICATE_TYPE_MISMATCH")
  })

  it("R09: statement predicateType != the bundle's declared type → STATEMENT_PREDICATE_TYPE_MISMATCH", () => {
    const f = verifyStatementBinding(b64(statement(DIGEST, PRED)), DIGEST, "https://other.example/type/v1")
    expect(f[0]?.code).toBe("STATEMENT_PREDICATE_TYPE_MISMATCH")
  })

  it("malformed statement bytes → STATEMENT_DECODE_FAILED", () => {
    const f = verifyStatementBinding(Buffer.from("not json{").toString("base64"), DIGEST, PRED)
    expect(f[0]?.code).toBe("STATEMENT_DECODE_FAILED")
  })

  it("wrong _type → STATEMENT_INVALID", () => {
    const f = verifyStatementBinding(
      b64({ _type: "nope", subject: [{ digest: { sha256: DIGEST } }], predicateType: PRED }),
      DIGEST,
      PRED,
    )
    expect(f[0]?.code).toBe("STATEMENT_INVALID")
  })

  it("empty subject[] → STATEMENT_INVALID", () => {
    const f = verifyStatementBinding(
      b64({ _type: "https://in-toto.io/Statement/v1", subject: [], predicateType: PRED }),
      DIGEST,
      PRED,
    )
    expect(f[0]?.code).toBe("STATEMENT_INVALID")
  })
})
