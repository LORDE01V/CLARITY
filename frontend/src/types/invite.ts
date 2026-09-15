/** Invite types matching backend app.models.invite */

import type { Role } from "./roles";

export interface InviteCreate {
  email: string;
  role?: Role;
}

export interface Invite {
  id: string;
  team_id: string;
  email: string;
  role: Role;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface InviteAcceptResponse {
  team_id: string;
  role: Role;
  membership_id: string;
}
