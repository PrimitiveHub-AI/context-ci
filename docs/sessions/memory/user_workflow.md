---
name: user-workflow
description: User often forwards prompts from another AI assistant and asks me to validate before executing
metadata: 
  node_type: memory
  type: user
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

The user works with another AI assistant ("AI gay assistant" in their phrasing) that drafts engineering prompts. They forward those prompts to me and explicitly ask me to *validate and evaluate* before implementing — not to execute blindly.

**How to apply:** When the user pastes a multi-section prompt and asks to "validate/evaluate," respond with a critical assessment first: (1) what the prompt gets right, (2) what's factually wrong about the current codebase state, (3) what's risky or out of scope, (4) what's missing, (5) recommended sequencing. Then ask before executing. The user values phased work over one-shot all-or-nothing pushes — they picked "Phase 1 only first, then review" the first time this came up.

The user's written English is non-native and informal (typos, missing articles). Don't comment on it; just be clear and structured in replies so nothing gets lost in translation.
