"""Parse and derive CLR-### task keys used to link GitHub activity to tasks."""

from __future__ import annotations

import re
from uuid import UUID

# Matches CLR-100 .. CLR-999 (and longer numeric suffixes if present).
_TASK_KEY_RE = re.compile(r"\bCLR-(\d+)\b", re.IGNORECASE)


def parse_task_keys(*texts: str | None) -> list[str]:
    """Extract unique CLR-### keys from issue/PR titles and bodies."""
    found: list[str] = []
    seen: set[str] = set()
    for text in texts:
        if not text:
            continue
        for match in _TASK_KEY_RE.finditer(text):
            key = f"CLR-{match.group(1)}"
            normalized = key.upper()
            # Preserve canonical CLR-<digits> casing.
            canonical = f"CLR-{match.group(1)}"
            if normalized not in seen:
                seen.add(normalized)
                found.append(canonical)
    return found


def display_task_key(task_id: UUID) -> str:
    """
    Derive the UI display key for a task id.

    Mirrors frontend `taskKey()` in `frontend/src/lib/tasks/display.ts`.
    """
    compact = str(task_id).replace("-", "")[-4:].upper()
    try:
        numeric = int(compact, 16)
    except ValueError:
        numeric = 0
    n = (numeric % 900) + 100 if numeric or compact else 100
    return f"CLR-{n}"
