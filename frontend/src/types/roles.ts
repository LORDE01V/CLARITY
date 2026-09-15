/**
 * Role definitions matching backend app.models.enums.Role.
 * Ordered by privilege level for RBAC checks on the client.
 */
export type Role = "guest" | "member" | "project_manager" | "owner";

export const ROLE_LEVELS: Record<Role, number> = {
  guest: 0,
  member: 1,
  project_manager: 2,
  owner: 3,
};

export function hasMinimumRole(actorRole: Role, requiredRole: Role): boolean {
  return ROLE_LEVELS[actorRole] >= ROLE_LEVELS[requiredRole];
}
