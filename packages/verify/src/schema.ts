/**
 * Minimal JSON Schema Draft 2020-12 validator — covers only the
 * keywords the Trust Bundle v0.1 schema uses. Hand-rolled for the
 * "<50KB minified, zero runtime deps" target (zero deps).
 *
 * Supported keywords:
 *   type, required, properties, additionalProperties,
 *   const, enum, pattern, minLength, minimum, format
 *
 * Supported format values: uri, uri-reference, date-time
 *
 * Anything beyond this subset is silently ignored — if you add a
 * schema feature, extend this validator AND add a conformance test
 * that exercises it. Per ADR-0021, the suite is the executable spec.
 */

import type { VerificationFailure } from "./errors.js"

type JsonValue = unknown
type Schema = Record<string, unknown>

const URI_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/
// uri-reference is lenient — allow relative URIs as well
const URI_REF_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$|^[^\s]*$/
// RFC 3339 date-time. Permissive — matches "YYYY-MM-DDTHH:MM:SS[.frac][+HH:MM|Z]".
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/

function isObject(v: JsonValue): v is Record<string, JsonValue> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function typeMatches(v: JsonValue, expected: string): boolean {
  switch (expected) {
    case "object":
      return isObject(v)
    case "array":
      return Array.isArray(v)
    case "string":
      return typeof v === "string"
    case "integer":
      return typeof v === "number" && Number.isInteger(v)
    case "number":
      return typeof v === "number" && Number.isFinite(v)
    case "boolean":
      return typeof v === "boolean"
    case "null":
      return v === null
    default:
      return false
  }
}

function checkFormat(value: string, format: string): boolean {
  switch (format) {
    case "uri":
      return URI_RE.test(value)
    case "uri-reference":
      return URI_REF_RE.test(value)
    case "date-time":
      return DATE_TIME_RE.test(value)
    default:
      return true // unknown formats are non-fatal per spec
  }
}

function joinPath(parent: string, segment: string | number): string {
  return parent === "" ? String(segment) : `${parent}.${segment}`
}

function validateNode(
  value: JsonValue,
  schema: Schema,
  path: string,
  failures: VerificationFailure[],
): void {
  // type (string only; we don't use the array form in v0.1)
  if (typeof schema.type === "string" && !typeMatches(value, schema.type)) {
    failures.push({
      step: "schema",
      code: "SCHEMA_INVALID",
      message: `expected type ${schema.type}, got ${value === null ? "null" : typeof value}`,
      path,
    })
    return
  }

  // const
  if ("const" in schema) {
    if (value !== schema.const) {
      // bundleVersion gets a specific code; everything else is generic schema-invalid
      const isBundleVersionField = path === "bundleVersion"
      failures.push({
        step: "schema",
        code: isBundleVersionField ? "UNKNOWN_BUNDLE_VERSION" : "SCHEMA_INVALID",
        message: `expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`,
        path,
      })
      return
    }
  }

  // enum
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      // backendName gets a specific code
      const isBackendField = path === "attestation.backendName"
      failures.push({
        step: "schema",
        code: isBackendField ? "UNKNOWN_BACKEND" : "SCHEMA_INVALID",
        message: `expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`,
        path,
      })
      return
    }
  }

  // string-specific
  if (typeof value === "string") {
    if (typeof schema.pattern === "string") {
      if (!new RegExp(schema.pattern).test(value)) {
        failures.push({
          step: "schema",
          code: "SCHEMA_INVALID",
          message: `string does not match pattern ${schema.pattern}`,
          path,
        })
      }
    }
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      failures.push({
        step: "schema",
        code: "SCHEMA_INVALID",
        message: `string shorter than minLength ${schema.minLength}`,
        path,
      })
    }
    if (typeof schema.format === "string" && !checkFormat(value, schema.format)) {
      failures.push({
        step: "schema",
        code: "SCHEMA_INVALID",
        message: `string does not match format ${schema.format}`,
        path,
      })
    }
  }

  // number-specific
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      failures.push({
        step: "schema",
        code: "SCHEMA_INVALID",
        message: `number below minimum ${schema.minimum}`,
        path,
      })
    }
  }

  // object-specific
  if (isObject(value)) {
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : []
    for (const key of required) {
      if (!(key in value)) {
        failures.push({
          step: "schema",
          code: "SCHEMA_INVALID",
          message: `required field missing: ${key}`,
          path: joinPath(path, key),
        })
      }
    }
    const properties = isObject(schema.properties)
      ? (schema.properties as Record<string, Schema>)
      : {}
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          failures.push({
            step: "schema",
            code: "SCHEMA_INVALID",
            message: `unexpected additional property: ${key}`,
            path: joinPath(path, key),
          })
        }
      }
    }
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in value) {
        validateNode(value[key], propSchema, joinPath(path, key), failures)
      }
    }
  }
}

export interface SchemaValidationResult {
  valid: boolean
  failures: VerificationFailure[]
}

export function validateAgainstSchema(
  value: JsonValue,
  schema: Schema,
): SchemaValidationResult {
  const failures: VerificationFailure[] = []
  validateNode(value, schema, "", failures)
  return { valid: failures.length === 0, failures }
}
