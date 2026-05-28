/**
 * CodeMirror adapter — maps WorkbenchFinding (line-based) to CodeMirror's
 * Diagnostic (byte-range-based) so the linter results render as inline
 * squiggles and tooltips in the editor.
 */

import type { Diagnostic } from "@codemirror/lint"
import type { EditorView } from "@codemirror/view"
import { lintWorkbenchContent } from "./lint"

export function lintFrontmatter(view: EditorView): Diagnostic[] {
  const content = view.state.doc.toString()
  const findings = lintWorkbenchContent(content)
  const totalLines = view.state.doc.lines

  return findings.map((f) => {
    const targetLine = Math.min(Math.max(1, f.line ?? 1), totalLines)
    const lineInfo = view.state.doc.line(targetLine)
    return {
      from: lineInfo.from,
      to: lineInfo.to,
      severity: f.severity,
      message: f.message,
      source: f.code,
    } satisfies Diagnostic
  })
}
