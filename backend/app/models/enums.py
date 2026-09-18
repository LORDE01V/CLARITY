"""
Role definitions for the Org -> Team -> Member hierarchy.

Roles are ordered by privilege level. Higher numeric values indicate
greater permissions within a team or organization context.
"""

from enum import Enum


class Role(str, Enum):
    """Team-scoped roles used for RBAC checks."""

    GUEST = "guest"
    MEMBER = "member"
    PROJECT_MANAGER = "project_manager"
    OWNER = "owner"

    @property
    def level(self) -> int:
        """Return numeric privilege level for comparison."""
        return _ROLE_LEVELS[self]


_ROLE_LEVELS: dict[Role, int] = {
    Role.GUEST: 0,
    Role.MEMBER: 1,
    Role.PROJECT_MANAGER: 2,
    Role.OWNER: 3,
}


def role_at_least(actor_role: Role, required_role: Role) -> bool:
    """
    Check whether actor_role meets or exceeds required_role.

    Used by RBAC dependencies to gate endpoints (e.g. only PM+ can invite).
    """
    return actor_role.level >= required_role.level


class TaskStatus(str, Enum):
    """Kanban column statuses for team tasks (Jira-style board)."""

    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"
