import type { Organization, Team } from "@/types";

/** Demo workspace used when VITE_AUTH_BYPASS is enabled. */
export const DEMO_ORG: Organization = {
  id: "00000000-0000-0000-0000-000000000010",
  name: "Clarity Demo",
  slug: "clarity-demo",
  owner_id: "00000000-0000-0000-0000-000000000001",
  created_at: new Date(0).toISOString(),
};

export const DEMO_TEAM: Team = {
  id: "00000000-0000-0000-0000-000000000020",
  org_id: DEMO_ORG.id,
  name: "General",
  created_at: new Date(0).toISOString(),
};
