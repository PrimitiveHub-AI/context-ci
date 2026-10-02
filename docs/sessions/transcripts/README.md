# Session transcripts (raw)

Raw Claude Code `.jsonl` transcripts are the **fallback** record, not the resume interface.
Resume from the ledgers (`../phub-*.md`), not from these files.

## Policy
- Raw `.jsonl` are multi-MB and private — they do **NOT** live on `main`.
- Archive them on branch **`session-archive`** (or Git-LFS), named `<session-id>.jsonl`.
- Source of truth for live transcripts:
  `~/.claude/projects/-srv-primitivehub-app/*.jsonl`
- The historical session (2026-06-04 → 2026-09-26) is one file:
  `18886129-88d6-46d0-b2c4-c992778859e9.jsonl`.

## Archive command (run when closing a session)
```bash
git switch session-archive 2>/dev/null || git switch -c session-archive
cp ~/.claude/projects/-srv-primitivehub-app/<uuid>.jsonl \
   docs/sessions/transcripts/<session-id>.jsonl
git add docs/sessions/transcripts/ && git commit -m "archive: <session-id> transcript"
git switch -   # back to your branch
```

## NEVER commit
Tokens/secrets. (A GitHub PAT was pasted in the historical transcript — rotate it; do not
publish that jsonl to any public remote.)
