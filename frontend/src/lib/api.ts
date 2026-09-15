/**
 * Typed HTTP client for the CLARITY FastAPI backend.
 *
 * Automatically attaches the Supabase JWT from the current session.
 */

import { getAccessToken } from "./supabase";
import type {
  AuthSession,
  GitHubActivityItem,
  GitHubConnect,
  GitHubStatus,
  Invite,
  InviteAcceptResponse,
  InviteCreate,
  LoginRequest,
  Organization,
  OrganizationCreate,
  RegisterRequest,
  Task,
  TaskCreate,
  TaskStatus,
  TaskStatusUpdate,
  TaskUpdate,
  Team,
  TeamCreate,
} from "@/types";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function formatErrorDetail(detail: unknown): string {
  if (typeof detail === "string" && detail.length > 0) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return null;
      })
      .filter(Boolean);
    if (parts.length > 0) return parts.join("; ");
  }
  return "Request failed";
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new ApiError(response.status, formatErrorDetail(body.detail));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (payload: LoginRequest) =>
      request<AuthSession>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    register: (payload: RegisterRequest) =>
      request<AuthSession>("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    me: () => request<AuthSession["user"]>("/auth/me"),
  },

  orgs: {
    create: (payload: OrganizationCreate) =>
      request<Organization>("/orgs", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    get: (orgId: string) => request<Organization>(`/orgs/${orgId}`),
  },

  teams: {
    create: (orgId: string, payload: TeamCreate) =>
      request<Team>(`/teams/org/${orgId}`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    list: (orgId: string) => request<Team[]>(`/teams/org/${orgId}`),

    get: (teamId: string) => request<Team>(`/teams/${teamId}`),
  },

  invites: {
    create: (teamId: string, payload: InviteCreate) =>
      request<Invite>(`/teams/${teamId}/invites`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    get: (token: string) => request<Invite>(`/invites/${token}`),

    accept: (token: string) =>
      request<InviteAcceptResponse>(`/invites/${token}/accept`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
  },

  tasks: {
    list: (teamId: string, status?: TaskStatus) => {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      return request<Task[]>(`/teams/${teamId}/tasks${query}`);
    },

    get: (teamId: string, taskId: string) =>
      request<Task>(`/teams/${teamId}/tasks/${taskId}`),

    create: (teamId: string, payload: TaskCreate) =>
      request<Task>(`/teams/${teamId}/tasks`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    update: (teamId: string, taskId: string, payload: TaskUpdate) =>
      request<Task>(`/teams/${teamId}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    move: (teamId: string, taskId: string, payload: TaskStatusUpdate) =>
      request<Task>(`/teams/${teamId}/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    delete: (teamId: string, taskId: string) =>
      request<void>(`/teams/${teamId}/tasks/${taskId}`, {
        method: "DELETE",
      }),
  },

  github: {
    activity: (limit = 50, teamId?: string) => {
      const params = new URLSearchParams({
        limit: String(limit),
      });
      if (teamId) params.set("team_id", teamId);
      return request<GitHubActivityItem[]>(`/github/activity?${params}`);
    },

    status: (probe = true, teamId?: string) => {
      const params = new URLSearchParams({
        probe: probe ? "true" : "false",
      });
      if (teamId) params.set("team_id", teamId);
      return request<GitHubStatus>(`/github/status?${params}`);
    },

    connect: (teamId?: string) => {
      const params = new URLSearchParams();
      if (teamId) params.set("team_id", teamId);
      const query = params.toString();
      return request<GitHubConnect>(
        `/github/connect${query ? `?${query}` : ""}`
      );
    },
  },
};

export { ApiError };
