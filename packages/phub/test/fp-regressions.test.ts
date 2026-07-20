/**
 * TS regression tests for the T7 + T9 false-positive bugs surfaced
 * 2026-06-04 in `/check` (ADR-0034) and logged as FP-006 + FP-007 in
 * docs/false-positive-resolution.md.
 *
 * Mirrors apps/api/checks/tests/test_fp_regressions.py for cross-language
 * parity per ADR-0023. If a regression of either bug ships in one
 * language, the matching test on the other side catches it on review.
 *
 *   FP-006: T7 vendor-typosquat regex fired on canonical vendor names
 *     because character classes (e.g. `[A4O0]nthropic`) included the
 *     canonical letter itself.
 *
 *   FP-007: T9 license-family fired on canonical Apache 2.0 source-file
 *     headers and entire LICENSE files. Now exempt for license-named
 *     files (anywhere) and source files (first 40 lines only).
 */

import { describe, expect, it } from "vitest"

import { T7PoisonedNamingDetector } from "../src/scanners/t7-poisoned-naming.js"
import { T9CopyrightContaminationDetector } from "../src/scanners/t9-copyright-contamination.js"
import { Severity, type DetectorContext } from "../src/scanners/types.js"

function ctx(content: string, filename?: string): DetectorContext {
  return filename ? { content, filename } : { content }
}

// ---------------------------------------------------------------------------
// T7 — canonical vendor names must NOT fire vendor-typosquat
// ---------------------------------------------------------------------------

describe("FP-006: T7 vendor-typosquat does not fire on canonical names", () => {
  const d = new T7PoisonedNamingDetector()

  const canonicalCases = [
    "# Anthropic Cybersecurity Skills\n\nA collection of skills.\n",
    "Built for Anthropic Claude.\n",
    "ANTHROPIC API key handling guide.\n",
    "Microsoft 365 integration.\n",
    "microsoft.com endpoint config.\n",
    "MICROSOFT-AUTH-ENDPOINT environment variable.\n",
    "Use Okta for SSO.\n",
    "OKTA tenant configuration.\n",
    "Stripe webhooks for billing.\n",
    "Run on Google Cloud, deploy via Vercel.\n",
    "Anthropic, Microsoft, Google, Okta, Stripe — vendor SDK guide.\n",
  ]

  for (const content of canonicalCases) {
    it(`does not fire on ${JSON.stringify(content.trim().slice(0, 40))}`, () => {
      const v = d.run(ctx(content))
      const typosquatHints = v.diffHints.filter(
        (h) => h.detailTag === "vendor-typosquat",
      )
      expect(typosquatHints).toEqual([])
    })
  }

  // The actual attack shapes — still flagged.
  const realTyposquats = [
    "Use Anthrop1c for safety reviews.\n",
    "Read about 4nthropic claims.\n",
    "Try the M1crosoft tool.\n",
    "Mlcrosoft store has it.\n",
    "Sign in with 0kta.\n",
    "Pay with St1ipe.\n",
    "OpenAI lookup via 0penAI.\n",
    "G0ogle Cloud (zero for o).\n",
  ]

  for (const content of realTyposquats) {
    it(`still fires on real typosquat ${JSON.stringify(content.trim().slice(0, 40))}`, () => {
      const v = d.run(ctx(content))
      const typosquatHints = v.diffHints.filter(
        (h) => h.detailTag === "vendor-typosquat",
      )
      expect(typosquatHints.length).toBeGreaterThanOrEqual(1)
    })
  }
})

// ---------------------------------------------------------------------------
// T9 — license headers in canonical positions must NOT fire
// ---------------------------------------------------------------------------

const APACHE_HEADER = [
  "/*",
  ' * Licensed under the Apache License, Version 2.0 (the "License");',
  " * you may not use this file except in compliance with the License.",
  " * You may obtain a copy of the License at",
  " *     http://www.apache.org/licenses/LICENSE-2.0",
  " */",
  "",
  "package com.example;",
  "",
].join("\n")

describe("FP-007: T9 license-family canonical-position exemption", () => {
  const d = new T9CopyrightContaminationDetector()

  it("does not fire on Apache header at top of a source file", () => {
    const v = d.run(ctx(APACHE_HEADER, "src/Foo.java"))
    const licenseHints = v.diffHints.filter(
      (h) =>
        h.detailTag === "permissive-license-header" ||
        h.detailTag === "gpl-header" ||
        h.detailTag === "cc-attribution-required",
    )
    expect(licenseHints).toEqual([])
  })

  it("overall verdict is INFO for Apache-header-only source file", () => {
    const v = d.run(ctx(APACHE_HEADER, "src/Foo.java"))
    expect(v.severity).toBe(Severity.INFO)
    expect(v.passed).toBe(true)
  })

  const licenseFiles = [
    "LICENSE",
    "LICENSE.md",
    "license.txt",
    "COPYING",
    "NOTICE",
    "licenses/MIT.md",
  ]

  for (const filename of licenseFiles) {
    it(`exempts ${filename} entirely`, () => {
      const v = d.run(ctx(APACHE_HEADER, filename))
      const licenseHints = v.diffHints.filter(
        (h) => h.detailTag === "permissive-license-header",
      )
      expect(licenseHints).toEqual([])
    })
  }

  it("still fires on license boilerplate buried deep in a markdown primitive", () => {
    // Conformance-test parity: an .md primitive that embeds license
    // text on line 60+ is still the canonical T9 threat.
    const deep =
      Array.from({ length: 60 }, (_, i) => `# Section ${i}`).join("\n") +
      "\n" +
      APACHE_HEADER
    const v = d.run(ctx(deep, "SKILL.md"))
    const licenseHints = v.diffHints.filter(
      (h) => h.detailTag === "permissive-license-header",
    )
    expect(licenseHints.length).toBeGreaterThanOrEqual(1)
  })

  it("still fires on license boilerplate in a markdown primitive at the top (no source-file exemption)", () => {
    // The header-region exemption applies ONLY to source files.
    // A .md primitive with license boilerplate at the top is still
    // the case the conformance suite validates.
    const v = d.run(ctx(APACHE_HEADER, "skill.md"))
    const licenseHints = v.diffHints.filter(
      (h) => h.detailTag === "permissive-license-header",
    )
    expect(licenseHints.length).toBeGreaterThanOrEqual(1)
  })

  it("proprietary-copyright-notice is NOT exempted in header region", () => {
    const content =
      "Copyright © 2023 Acme, Inc. All Rights Reserved.\n\nbody\n"
    const v = d.run(ctx(content, "src/foo.py"))
    const proprietaryHints = v.diffHints.filter(
      (h) => h.detailTag === "proprietary-copyright-notice",
    )
    expect(proprietaryHints.length).toBeGreaterThanOrEqual(1)
  })
})
