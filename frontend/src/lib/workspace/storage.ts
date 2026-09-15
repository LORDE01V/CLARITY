/**
 * Persist the active org/team selection per authenticated user.
 *
 * The backend has no "list my memberships" endpoint yet, so the client
 * remembers the workspace chosen after create-org or invite-accept.
 */

export interface WorkspaceSelection {
  orgId: string;
  teamId: string;
}

const STORAGE_PREFIX = "clarity_workspace:";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadWorkspaceSelection(userId: string): WorkspaceSelection | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkspaceSelection>;
    if (
      typeof parsed.orgId === "string" &&
      parsed.orgId.length > 0 &&
      typeof parsed.teamId === "string" &&
      parsed.teamId.length > 0
    ) {
      return { orgId: parsed.orgId, teamId: parsed.teamId };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveWorkspaceSelection(userId: string, selection: WorkspaceSelection): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(selection));
}

export function clearWorkspaceSelection(userId: string): void {
  localStorage.removeItem(storageKey(userId));
}

/** Build a URL-safe slug from an organization name. */
export function slugifyOrgName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
