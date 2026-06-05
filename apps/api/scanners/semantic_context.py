"""Semantic context utilities — v0.2.2 (ADR-0036).

Three pure predicates that classify the prose AROUND a regex match,
not the syntactic location of the match itself (that is ADR-0035's
markdown context analyzer). Each predicate answers ONE question:

    is_in_negation_context    — "is the match scoped under a negation?"
    is_in_mention_context     — "is the match a reference to the vendor,
                                 not a claim to BE the vendor?"
    is_in_declaration_context — "is the match a license being described,
                                 not a license under which content is copied?"

These are heuristics. The corpus measurement (ADR-0032) is the arbiter
— if a v0.2.2 keyword set drops recall on an existing adversarial
sample, the CI gate blocks the merge.

Lockstep partner: packages/phub/src/scanners/semantic-context.ts —
both sides MUST produce identical verdicts for the same input.
"""

from __future__ import annotations

import re

# Maximum lookback when searching for sentence start.
MAX_SENTENCE_LOOKBACK = 240

# Common non-terminal "." abbreviations the sentence-boundary heuristic
# should skip. Not a real tokenizer — covers the cases we actually see.
_ABBREV_BEFORE_DOT = re.compile(r"\b(?:Mr|Mrs|Dr|St|Mt|Jr|Sr|vs|etc|e\.g|i\.e)\.$", re.IGNORECASE)


def find_sentence_start(content: str, pos: int) -> int:
    """Find the offset where the sentence containing ``pos`` starts.

    Walks backward through ``content`` looking for a sentence terminator
    (``. `` / ``! `` / ``? `` / ``\\n\\n``). Returns the offset of the
    first character of the current sentence. Caps the search at
    MAX_SENTENCE_LOOKBACK characters.
    """
    floor = max(0, pos - MAX_SENTENCE_LOOKBACK)
    i = pos - 1
    while i > floor:
        c = content[i]
        if c == "\n":
            if i > 0 and content[i - 1] == "\n":
                return i + 1
            i -= 1
            continue
        if c in ".!?":
            trailing = content[max(0, i - 5) : i + 1]
            if _ABBREV_BEFORE_DOT.search(trailing):
                i -= 1
                continue
            if i + 1 < len(content) and content[i + 1].isspace():
                return i + 2
        i -= 1
    return floor


# ---------------------------------------------------------------------------
# is_in_negation_context
# ---------------------------------------------------------------------------

_NEGATION_KEYWORDS_SOURCE = [
    r"\bnever\b",
    r"\bdo not\b",
    r"\bdon't\b",
    r"\bdoes not\b",
    r"\bdoesn't\b",
    r"\bforbidden\b",
    r"\bprohibited\b",
    r"\bavoid\b",
    r"\bavoids\b",
    r"\bavoiding\b",
    r"\bmust not\b",
    r"\bmustn't\b",
    r"\bshould not\b",
    r"\bshouldn't\b",
    r"\brefuse to\b",
    r"\brefuses to\b",
    r"\brefused\b",
    r"\bcannot\b",
    r"\bcan't\b",
    r"\bno\b",
    r"\bnot\b",
    r"\bnone of\b",
    r"\bdisallowed\b",
    r"\bbanned\b",
    r"\bunsafe\b",
    r"\bvulnerable\b",
    r"\battack(?:s|er|ed|ing)?\b",
    r"\bvector\b",
    r"\bmalicious\b",
]

_NEGATION_RE = re.compile("|".join(_NEGATION_KEYWORDS_SOURCE), re.IGNORECASE)


def is_in_negation_context(content: str, match_start: int) -> bool:
    """True iff the match is preceded by a negation keyword within
    the same sentence."""
    sentence_start = find_sentence_start(content, match_start)
    before = content[sentence_start:match_start]
    return _NEGATION_RE.search(before) is not None


# ---------------------------------------------------------------------------
# is_in_mention_context
# ---------------------------------------------------------------------------

_MENTION_BEFORE_RE = re.compile(
    r"\b(?:like|as|such as|similar to|compared to|vs|versus|tier of|inspired by|in the style of|alongside|including|including:|register to|borrowing from)\s*$",
    re.IGNORECASE,
)

_MENTION_AFTER_RE = re.compile(
    r"^(?:'s\s+\w+|-style\b|-grade\b|-quality\b|-class\b|-level\b|\s*[,/]\s*(?:and\s+)?[A-Z]\w+|\s+(?:doesn't|does not|tier\b|Docs\b|docs\b|site\b|Foundation\b|blog\b|guide\b|design\b|dashboard\b|roadmap\b|design\s+system\b|design\s+language\b))"
)

_LIST_BEFORE_RE = re.compile(r"[,/]\s*$")
_LIST_AFTER_RE = re.compile(r"^(?:\s*[,/]?\s*[a-z'A-Z][a-zA-Z'’]+)")


def is_in_mention_context(content: str, match_start: int, match_end: int) -> bool:
    """True iff the match appears in a mention/reference context.

    Window: 50 chars before + 50 chars after the match.
    """
    before = content[max(0, match_start - 50) : match_start]
    after = content[match_end : min(len(content), match_end + 50)]
    if _MENTION_BEFORE_RE.search(before):
        return True
    if _MENTION_AFTER_RE.search(after):
        return True
    if _LIST_BEFORE_RE.search(before) and _LIST_AFTER_RE.search(after):
        return True
    return False


# ---------------------------------------------------------------------------
# is_in_declaration_context
# ---------------------------------------------------------------------------

_DECLARATION_AFTER_RE = re.compile(
    r"^\s*\((?:corpus|primitive|content|license|licensed|ships under|published under|under|the\s+\w+\s+license)[^)]{0,40}\)",
    re.IGNORECASE,
)

_DECLARATION_BEFORE_RE = re.compile(
    r"(?:license\s*(?:is|:)\s*|ships\s+under\s+|published\s+under\s+|licensed\s+as\s+|licensed\s+under\s+|is\s+licensed\s+)$",
    re.IGNORECASE,
)


def is_in_declaration_context(content: str, match_start: int, match_end: int) -> bool:
    """True iff the matched license string sits in a declaration context."""
    after = content[match_end : min(len(content), match_end + 60)]
    if _DECLARATION_AFTER_RE.search(after):
        return True
    before = content[max(0, match_start - 30) : match_start]
    if _DECLARATION_BEFORE_RE.search(before):
        return True
    return False


# ----- is_in_quoted_phrase ---------------------------------------------------

def is_in_quoted_phrase(content: str, match_start: int, match_end: int) -> bool:
    """True iff the match is wrapped by a matching pair of ASCII single or
    double quotes immediately adjacent — i.e. the surrounding prose is
    DESCRIBING the phrase, not asserting it.

    Closes FP-013 (CCI-008 vague-trigger inside meta-prose) and FP-014
    (CCI-001 override-phrase inside defender prose enumerating attacker
    phrasings). Both shapes:

        "ignore previous instructions"   → quoted enumeration of attacker phrases
        'studies show'                   → quoted vague-trigger taxonomy

    Lockstep partner: ``packages/phub/src/scanners/semantic-context.ts``
    must produce identical results for the same input.
    """
    if match_start == 0 or match_end >= len(content):
        return False
    before = content[match_start - 1]
    after = content[match_end]
    if before not in {'"', "'"}:
        return False
    return after == before
