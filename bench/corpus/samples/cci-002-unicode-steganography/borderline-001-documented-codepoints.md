# Unicode steganography defender

This primitive teaches the agent to flag content that may contain
invisible codepoints. Watch for these ranges:

- Zero-width characters: U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ),
  U+2060 (WJ), U+FEFF (BOM).
- Bidi controls: U+202A (LRE), U+202B (RLE), U+202C (PDF),
  U+202D (LRO), U+202E (RLO), U+2066–U+2069 (LRI / RLI / FSI / PDI).
- Tag characters: U+E0000 through U+E007F.

When any of these codepoints appear in agent-context that wasn't
authored for legitimate i18n purposes (emoji composition, Arabic /
Hebrew text), the agent flags the content and refuses to load it.

This file references the codepoints by name, not by embedding them.
The detector should NOT flag the prose of this primitive itself.
