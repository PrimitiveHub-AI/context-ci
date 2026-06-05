# Context-bloat threat-class overview

This primitive describes the CCI-010 attack family. The family
covers primitives that waste the agent's context budget through
four mechanical patterns:

- Oversized primitives that exceed a per-primitive character
  budget without proportionate informational content.
- Excessive repetition of non-trivial lines, often used to
  manipulate the agent's salience toward a particular instruction.
- Whitespace stuffing, where blank lines dominate a long file and
  the visible payload is a small fraction of the byte count.
- Heading proliferation, where the file structure outpaces the
  semantic content and each section carries only a few sentences.

The safe runtime measures each primitive against these thresholds
before admitting it into the agent's working context. Primitives
that exceed any threshold are routed to manual review.
