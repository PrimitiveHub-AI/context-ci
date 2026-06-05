# Copyright-contamination threat-class overview

This primitive describes the CCI-009 attack family. The family
covers primitives that embed verbatim license boilerplate, third-
party copyright notices, or community-source attribution markers
that transitively impose licensing obligations on the consumer.

Five recognised sub-shapes:

- Permissive-license-header: MIT, Apache-2.0, BSD, MPL boilerplate.
- GPL-family-header: GPL, LGPL, AGPL boilerplate.
- Proprietary-copyright-notice: third-party copyright lines.
- CC-attribution-required: Creative Commons license markers.
- Forum-source-attribution: copied-from-StackOverflow markers.

The agent should consume primitives only when their license is
explicit and compatible with the host project's license. The
runtime never silently inherits unknown licensing.
