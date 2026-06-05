/**
 * Client-side mirror of the server's `_sniff_mode` (apps/api/checks/api.py).
 *
 * Used only to render the "detected:" badge under the input box so the
 * user knows what's about to happen before they click Check. The
 * authoritative dispatch happens server-side; if the two ever drift,
 * the server wins.
 */
import type { CheckMode } from "./types"

const OWNER_PART = "[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})"
const REPO_PART = "[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}"

// Anywhere-in-input github URL / SSH coord / claude-skill-install coord.
// Mirrors apps/api/checks/github_resolver.py _URL_RE / _SSH_RE / _CLAUDE_SKILL_RE.
const GITHUB_URL_RE = new RegExp(
  `https?://(?:www\\.)?github\\.com/${OWNER_PART}/${REPO_PART}`,
  "i",
)
const GITHUB_SSH_RE = new RegExp(
  `git@github\\.com:${OWNER_PART}/${REPO_PART}`,
  "i",
)
const CLAUDE_SKILL_RE = new RegExp(
  `claude\\s+skill\\s+install\\s+${OWNER_PART}/${REPO_PART}`,
  "i",
)
const BARE_OWNER_REPO_RE = new RegExp(
  `^\\s*${OWNER_PART}/${REPO_PART}\\s*$`,
)

const NPX_PREFIXES = [
  "npx ",
  "pnpx ",
  "bunx ",
  "yarn dlx ",
  "pnpm dlx ",
  "npm install ",
  "npm i ",
  "npm add ",
  "pnpm install ",
  "pnpm add ",
  "yarn add ",
  "bun add ",
]

function looksLikeGithub(stripped: string): boolean {
  if (!stripped) return false
  if (GITHUB_URL_RE.test(stripped)) return true
  if (GITHUB_SSH_RE.test(stripped)) return true
  if (CLAUDE_SKILL_RE.test(stripped)) return true
  // Bare `owner/repo` — only when the whole input is exactly that.
  return BARE_OWNER_REPO_RE.test(stripped)
}

export interface SniffResult {
  mode: CheckMode
  label: string
  description: string
}

export function sniffMode(raw: string): SniffResult | null {
  const stripped = raw.trim()
  if (!stripped) return null
  const lowered = stripped.toLowerCase()

  if (looksLikeGithub(stripped)) {
    return {
      mode: "github",
      label: "GitHub repo",
      description:
        "Fetches the codeload.github.com tarball, unpacks it in memory, scans every text file. Never git-clones; never executes.",
    }
  }

  if (NPX_PREFIXES.some((p) => lowered.startsWith(p))) {
    return {
      mode: "npx",
      label: "npm package",
      description:
        "Fetches the registry.npmjs.org tarball, verifies its integrity digest, unpacks in memory, scans every text file. Never executes.",
    }
  }

  if (lowered.startsWith("http://") || lowered.startsWith("https://")) {
    return {
      mode: "url",
      label: "URL",
      description:
        "Fetches via https only. Refuses private IPs and oversized responses. Scans the response body.",
    }
  }

  if (
    stripped.startsWith("@") &&
    stripped.includes("/") &&
    !stripped.includes(" ")
  ) {
    return {
      mode: "npx",
      label: "npm package",
      description:
        "Scoped package coordinate. Fetches the registry tarball and scans it statically.",
    }
  }

  if (
    !stripped.includes("\n") &&
    !stripped.includes(" ") &&
    stripped.length <= 214 &&
    stripped.includes("@")
  ) {
    return {
      mode: "npx",
      label: "npm package",
      description:
        "Bare npm coordinate. Fetches the registry tarball and scans it statically.",
    }
  }

  return {
    mode: "content",
    label: "Raw content",
    description:
      "Scanned in-process against the Context CI Top 10. Never persisted; never executed.",
  }
}
