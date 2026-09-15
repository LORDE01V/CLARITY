/**
 * Active organization / team context for the authenticated session.
 *
 * Hydrates from localStorage, then verifies via existing org/team APIs.
 * Create-org and invite-accept update the selection so the dashboard
 * stays scoped to a real team id.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError } from "@/lib/api";
import { DEMO_ORG, DEMO_TEAM } from "@/lib/workspace/demo";
import {
  clearWorkspaceSelection,
  loadWorkspaceSelection,
  saveWorkspaceSelection,
  slugifyOrgName,
} from "@/lib/workspace/storage";
import type { Organization, OrganizationCreate, Team } from "@/types";

interface WorkspaceContextValue {
  org: Organization | null;
  team: Team | null;
  teams: Team[];
  loading: boolean;
  needsOnboarding: boolean;
  error: string | null;
  createOrganization: (payload: OrganizationCreate) => Promise<void>;
  selectTeam: (teamId: string) => Promise<void>;
  adoptTeam: (teamId: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function formatApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return typeof err.message === "string" ? err.message : fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isBypassMode } = useAuth();
  const [org, setOrg] = useState<Organization | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySelection = useCallback(
    async (orgId: string, teamId: string, userId: string) => {
      const [nextOrg, nextTeams] = await Promise.all([
        api.orgs.get(orgId),
        api.teams.list(orgId),
      ]);
      const nextTeam =
        nextTeams.find((item) => item.id === teamId) ??
        (await api.teams.get(teamId));

      setOrg(nextOrg);
      setTeams(nextTeams);
      setTeam(nextTeam);
      saveWorkspaceSelection(userId, { orgId: nextOrg.id, teamId: nextTeam.id });
    },
    []
  );

  const hydrate = useCallback(async () => {
    if (!user) {
      setOrg(null);
      setTeam(null);
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    if (isBypassMode) {
      setOrg(DEMO_ORG);
      setTeam(DEMO_TEAM);
      setTeams([DEMO_TEAM]);
      setLoading(false);
      return;
    }

    const saved = loadWorkspaceSelection(user.id);
    if (!saved) {
      setOrg(null);
      setTeam(null);
      setTeams([]);
      setLoading(false);
      return;
    }

    try {
      await applySelection(saved.orgId, saved.teamId, user.id);
    } catch (err) {
      clearWorkspaceSelection(user.id);
      setOrg(null);
      setTeam(null);
      setTeams([]);
      setError(formatApiError(err, "Could not restore your workspace"));
    } finally {
      setLoading(false);
    }
  }, [user, isBypassMode, applySelection]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const createOrganization = useCallback(
    async (payload: OrganizationCreate) => {
      if (!user) throw new Error("You must be signed in");
      if (isBypassMode) {
        setOrg({ ...DEMO_ORG, name: payload.name, slug: payload.slug });
        setTeam(DEMO_TEAM);
        setTeams([DEMO_TEAM]);
        return;
      }

      setError(null);
      const created = await api.orgs.create(payload);
      const orgTeams = await api.teams.list(created.id);
      const general =
        orgTeams.find((item) => item.name.toLowerCase() === "general") ??
        orgTeams[0];

      if (!general) {
        throw new Error("Organization created, but no default team was returned");
      }

      setOrg(created);
      setTeams(orgTeams);
      setTeam(general);
      saveWorkspaceSelection(user.id, { orgId: created.id, teamId: general.id });
    },
    [user, isBypassMode]
  );

  const selectTeam = useCallback(
    async (teamId: string) => {
      if (!user || !org) return;
      if (isBypassMode) {
        const demo = teams.find((item) => item.id === teamId) ?? DEMO_TEAM;
        setTeam(demo);
        return;
      }

      const next = teams.find((item) => item.id === teamId) ?? (await api.teams.get(teamId));
      setTeam(next);
      saveWorkspaceSelection(user.id, { orgId: org.id, teamId: next.id });
    },
    [user, org, teams, isBypassMode]
  );

  /** After invite accept: resolve team → org and persist as active workspace. */
  const adoptTeam = useCallback(
    async (teamId: string) => {
      if (!user) throw new Error("You must be signed in");
      if (isBypassMode) {
        setOrg(DEMO_ORG);
        setTeam(DEMO_TEAM);
        setTeams([DEMO_TEAM]);
        return;
      }

      setError(null);
      const nextTeam = await api.teams.get(teamId);
      const nextOrg = await api.orgs.get(nextTeam.org_id);
      const orgTeams = await api.teams.list(nextOrg.id);

      setOrg(nextOrg);
      setTeam(nextTeam);
      setTeams(orgTeams);
      saveWorkspaceSelection(user.id, { orgId: nextOrg.id, teamId: nextTeam.id });
    },
    [user, isBypassMode]
  );

  const refresh = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const clearError = useCallback(() => setError(null), []);

  const needsOnboarding = Boolean(user && !isBypassMode && !loading && !org);

  const value = useMemo(
    () => ({
      org,
      team,
      teams,
      loading,
      needsOnboarding,
      error,
      createOrganization,
      selectTeam,
      adoptTeam,
      refresh,
      clearError,
    }),
    [
      org,
      team,
      teams,
      loading,
      needsOnboarding,
      error,
      createOrganization,
      selectTeam,
      adoptTeam,
      refresh,
      clearError,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

export { slugifyOrgName };
