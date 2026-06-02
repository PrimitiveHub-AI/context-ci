/**
 * Hand-rolled mini JSON Schema validator covering only the keywords
 * the v0.1 policy schema uses. Same approach as
 * packages/verify/src/schema.ts — zero deps, auditable, sufficient.
 *
 * Supports: type, required, properties, additionalProperties,
 * patternProperties, items, enum, const, minLength, minItems, not.
 */

export interface SchemaValidationError {
  path: string
  message: string
}

interface AnySchema {
  type?: string
  required?: string[]
  properties?: Record<string, AnySchema>
  patternProperties?: Record<string, AnySchema>
  additionalProperties?: boolean | AnySchema
  items?: AnySchema
  enum?: unknown[]
  const?: unknown
  minLength?: number
  minItems?: number
  not?: Record<string, unknown>
}

export function validateAgainstSchema(
  value: unknown,
  schema: object,
  path = "",
): SchemaValidationError[] {
  return validate(value, schema as AnySchema, path)
}

function validate(value: unknown, schema: AnySchema, path: string): SchemaValidationError[] {
  const errors: SchemaValidationError[] = []
  const here = path || "<root>"

  if (schema.not !== undefined) {
    errors.push({ path: here, message: "field is reserved in v0.1 and must not be present" })
    return errors
  }

  if (schema.const !== undefined) {
    if (value !== schema.const) {
      errors.push({
        path: here,
        message: `expected const value ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`,
      })
    }
  }

  if (schema.enum !== undefined) {
    if (!schema.enum.some((v) => v === value)) {
      errors.push({
        path: here,
        message: `expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`,
      })
    }
  }

  if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push({ path: here, message: `expected object, got ${typeOf(value)}` })
      return errors
    }
    const obj = value as Record<string, unknown>
    for (const r of schema.required ?? []) {
      if (!(r in obj)) errors.push({ path: here, message: `missing required field '${r}'` })
    }
    const knownKeys = new Set(Object.keys(schema.properties ?? {}))
    for (const [k, v] of Object.entries(obj)) {
      const subPath = path === "" ? k : `${path}.${k}`
      if (schema.properties && knownKeys.has(k)) {
        errors.push(...validate(v, schema.properties[k]!, subPath))
        continue
      }
      let patternMatched = false
      for (const [re, subSchema] of Object.entries(schema.patternProperties ?? {})) {
        if (new RegExp(re).test(k)) {
          errors.push(...validate(v, subSchema, subPath))
          patternMatched = true
        }
      }
      if (patternMatched) continue
      if (schema.additionalProperties === false) {
        errors.push({ path: subPath, message: `unknown field '${k}'` })
      } else if (typeof schema.additionalProperties === "object") {
        errors.push(...validate(v, schema.additionalProperties, subPath))
      }
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push({ path: here, message: `expected array, got ${typeOf(value)}` })
      return errors
    }
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path: here, message: `expected at least ${schema.minItems} items, got ${value.length}` })
    }
    if (schema.items) {
      value.forEach((item, i) => {
        errors.push(...validate(item, schema.items!, `${path}[${i}]`))
      })
    }
  } else if (schema.type === "string") {
    if (typeof value !== "string") {
      errors.push({ path: here, message: `expected string, got ${typeOf(value)}` })
      return errors
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path: here, message: `expected string of minLength ${schema.minLength}, got ${value.length}` })
    }
  } else if (schema.type === "boolean") {
    if (typeof value !== "boolean") {
      errors.push({ path: here, message: `expected boolean, got ${typeOf(value)}` })
    }
  }

  return errors
}

function typeOf(v: unknown): string {
  if (v === null) return "null"
  if (Array.isArray(v)) return "array"
  return typeof v
}
