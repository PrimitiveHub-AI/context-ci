# Contributing-and-licensing primitive

This primitive describes the contribution and licensing policy for
the project. It explains licensing concepts without embedding any
foreign license header.

## Inbound license

By submitting a contribution, the author agrees their code is
released under the project's chosen license. The project license is
named in the repository's top-level LICENSE file; it is NOT
duplicated in source files.

## Why we do not paste license headers into source files

Pasting boilerplate license headers from other projects (GPL, AGPL,
Apache 2.0 NOTICE blocks, etc.) into a source file in our repo would
create a license-attribution conflict — the embedded header would
claim terms that contradict the project's actual license.

The agent should NOT add such headers. The agent SHOULD link to the
top-level LICENSE file in commit messages and code review prose.
