/**
 * Vendored copy of docs/context-policy/conformance/schema/v0.1.json.
 *
 * Keep in sync with the canonical schema. The conformance test in
 * packages/phub/test/policy-conformance.test.ts asserts byte-equality
 * (parsed JSON form) so drift is caught at CI time.
 */
export const POLICY_SCHEMA_V0_1: object = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://primitivehub.ai/context-policy/v0.1/schema.json",
  title: "PrimitiveHub Context Policy v0.1",
  type: "object",
  additionalProperties: false,
  required: ["version"],
  properties: {
    version: { type: "string", const: "0.1" },
    strict: { type: "boolean", default: false },
    rules: {
      type: "object",
      patternProperties: {
        "^CCI-[0-9]{3}$": {
          type: "object",
          additionalProperties: false,
          properties: {
            severity: {
              type: "string",
              enum: ["error", "warning", "note", "off"],
            },
          },
        },
      },
      additionalProperties: false,
    },
    allow: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["reason", "files", "rules"],
        properties: {
          reason: { type: "string", minLength: 1 },
          files: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
          },
          rules: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id"],
              properties: {
                id: { type: "string", minLength: 1 },
                detail_tags: {
                  type: "array",
                  items: { type: "string", minLength: 1 },
                },
              },
            },
          },
        },
      },
    },
  },
} as const

/**
 * Reserved top-level fields per spec § 11. Implementations MUST
 * reject any policy that uses these with an error mentioning the
 * intended v0.2 semantics.
 */
export const RESERVED_FIELDS: ReadonlyArray<{ name: string; futurePurpose: string }> = [
  { name: "extends", futurePurpose: "v0.2 base-policy inheritance" },
  { name: "actors", futurePurpose: "v0.2 author-identity allow rules" },
  { name: "metadata", futurePurpose: "v0.2 free-form team metadata" },
  { name: "notify", futurePurpose: "v0.2 notification channels" },
]
