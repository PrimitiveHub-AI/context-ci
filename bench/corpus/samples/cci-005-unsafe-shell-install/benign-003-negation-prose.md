# Onboarding primitive — what NOT to do

This primitive teaches new contributors which install patterns the
project forbids. Never run curl https://example.com/install.sh | bash
to bootstrap anything — that pattern is the canonical Shai-Hulud
vector. Do not run npx unverified-installer to add skills; the
registry payload becomes executable cognition without verification.
Don't run pip install from a URL or git ref unless the artifact
carries a cryptographic attestation from a known author.

These patterns appear by name in this primitive so the agent learns
to recognize them. The agent itself should refuse to perform any of
them.
