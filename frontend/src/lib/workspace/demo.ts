/** Unused — kept only so old imports do not break during cleanup. Prefer live API. */
import type { Organization, Team } from "@/types";

export const DEMO_ORG: Organization = {
  id: "00000000-0000-0000-0000-000000000010",
  name: "Workspace",
  slug: "workspace",
  owner_id: "00000000-0000-0000-0000-000000000001",
  created_at: new Date(0).toISOString(),
};

export const DEMO_TEAM: Team = {
  id: "00000000-0000-0000-0000-000000000020",
  org_id: DEMO_ORG.id,
  name: "General",
  created_at: new Date(0).toISOString(),
};
