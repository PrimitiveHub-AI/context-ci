"use client"

import { useEffect, useRef } from "react"
import { EditorState, type Extension } from "@codemirror/state"
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view"
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands"
import { markdown } from "@codemirror/lang-markdown"
import {
  HighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
} from "@codemirror/language"
import { lintGutter } from "@codemirror/lint"
import { tags as t } from "@lezer/highlight"

// Theme aligned to the PrimitiveHub palette (dark, cyan accent, muted greys).
// Uses the same CSS variables that drive the rest of the app so it stays
// consistent with shadcn theming.
const phubEditorTheme = EditorView.theme(
  {
    "&": {
      background: "transparent",
      color: "var(--color-foreground)",
      fontSize: "13px",
      height: "100%",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      lineHeight: "1.7",
    },
    ".cm-content": {
      padding: "16px 0",
      caretColor: "var(--color-primary)",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-gutters": {
      background: "transparent",
      // Line numbers must stay legible — 60%-alpha muted read as broken.
      color: "var(--color-muted-foreground)",
      borderRight: "1px solid color-mix(in oklch, var(--color-border) 60%, transparent)",
      fontSize: "11px",
      paddingRight: "8px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      minWidth: "36px",
      padding: "0 8px",
    },
    ".cm-activeLine": {
      background: "color-mix(in oklch, var(--color-foreground) 3%, transparent)",
    },
    ".cm-activeLineGutter": {
      background: "transparent",
      color: "var(--color-foreground)",
    },
    ".cm-selectionBackground, .cm-content ::selection": {
      background:
        "color-mix(in oklch, var(--color-primary) 20%, transparent) !important",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-primary)",
    },
    ".cm-tooltip": {
      background: "var(--color-card)",
      border: "1px solid var(--color-border)",
      color: "var(--color-foreground)",
      fontSize: "11px",
      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      borderRadius: "6px",
      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      padding: "0",
    },
    ".cm-tooltip.cm-tooltip-cursor": {
      padding: "6px 10px",
    },
    ".cm-diagnostic": {
      padding: "6px 10px",
      borderLeft: "2px solid transparent",
    },
    ".cm-diagnostic-error": {
      borderLeftColor: "var(--color-destructive)",
      background: "color-mix(in oklch, var(--color-destructive) 4%, transparent)",
    },
    ".cm-diagnostic-warning": {
      borderLeftColor: "var(--color-amber)",
      background: "color-mix(in oklch, var(--color-amber) 4%, transparent)",
    },
    ".cm-diagnostic-info": {
      borderLeftColor: "var(--color-primary)",
      background: "color-mix(in oklch, var(--color-primary) 4%, transparent)",
    },
    // Diagnostic underline squiggles
    ".cm-lintRange-error": {
      backgroundImage:
        "linear-gradient(45deg, transparent 65%, var(--color-destructive) 80%, transparent 90%), linear-gradient(135deg, transparent 5%, var(--color-destructive) 15%, transparent 25%, transparent 65%, var(--color-destructive) 80%, transparent 90%)",
      backgroundSize: "6px 3px",
      backgroundRepeat: "repeat-x",
      backgroundPosition: "0 100%",
    },
    ".cm-lintRange-warning": {
      backgroundImage:
        "linear-gradient(45deg, transparent 65%, var(--color-amber) 80%, transparent 90%), linear-gradient(135deg, transparent 5%, var(--color-amber) 15%, transparent 25%, transparent 65%, var(--color-amber) 80%, transparent 90%)",
      backgroundSize: "6px 3px",
      backgroundRepeat: "repeat-x",
      backgroundPosition: "0 100%",
    },
  },
  { dark: true },
)

const phubHighlightStyle = HighlightStyle.define([
  { tag: t.heading, color: "var(--color-foreground)", fontWeight: "600" },
  { tag: t.heading1, fontSize: "1.2em" },
  { tag: t.heading2, fontSize: "1.1em" },
  { tag: t.heading3, fontSize: "1.05em" },
  { tag: t.strong, color: "var(--color-foreground)", fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.link, color: "var(--color-primary)", textDecoration: "underline" },
  { tag: t.url, color: "var(--color-primary)" },
  {
    tag: t.list,
    color: "color-mix(in oklch, var(--color-muted-foreground) 80%, var(--color-foreground))",
  },
  { tag: t.quote, color: "var(--color-muted-foreground)", fontStyle: "italic" },
  {
    tag: t.monospace,
    color: "var(--color-foreground)",
    background: "color-mix(in oklch, var(--color-secondary) 50%, transparent)",
    padding: "1px 4px",
    borderRadius: "3px",
  },
  { tag: t.keyword, color: "var(--color-primary)" },
  {
    tag: t.string,
    color: "color-mix(in oklch, var(--color-primary) 80%, var(--color-foreground))",
  },
  {
    tag: t.comment,
    color: "color-mix(in oklch, var(--color-muted-foreground) 60%, transparent)",
    fontStyle: "italic",
  },
  { tag: t.meta, color: "var(--color-muted-foreground)" },
  {
    tag: t.punctuation,
    color: "color-mix(in oklch, var(--color-muted-foreground) 80%, transparent)",
  },
  {
    tag: t.processingInstruction,
    color: "var(--color-primary)",
  },
])

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  extensions?: Extension[]
  className?: string
}

export function MarkdownEditor({
  value,
  onChange,
  extensions = [],
  className,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  // Keep onChange in a ref so we can mutate the editor without re-initializing
  // when the parent's onChange identity changes.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        indentOnInput(),
        bracketMatching(),
        markdown(),
        syntaxHighlighting(phubHighlightStyle),
        lintGutter(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        phubEditorTheme,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        ...extensions,
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Only initialize once. Extensions and value sync happen below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync external value changes into the editor (controlled-input pattern)
  useEffect(() => {
    const view = viewRef.current
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      })
    }
  }, [value])

  return <div ref={containerRef} className={className} />
}
