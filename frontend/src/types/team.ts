/** Team types matching backend app.models.team */

import type { Role } from "./roles";

export interface Team {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

export interface TeamCreate {
  name: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
}

export interface TeamMemberWithUser extends TeamMember {
  email: string;
  full_name: string | null;
}
