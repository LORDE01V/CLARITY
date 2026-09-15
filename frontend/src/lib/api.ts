/**
 * Typed HTTP client for the CLARITY FastAPI backend.
 *
 * Automatically attaches the Supabase JWT from the current session.
 */

import { getAccessToken } from "./supabase";
import type {
  AuthSession,
  ChatChannel,
  ChatChannelCreate,
  ChatDirectMessageCreate,
  ChatGroupCreate,
  ChatMessage,
  ChatMessageCreate,
  ChatMessagePage,
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
  TeamMemberWithUser,
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
  options: RequestInit & { accessToken?: string | null } = {}
): Promise<T> {
  const { accessToken, ...init } = options;
  const token =
    accessToken === undefined ? await getAccessToken() : accessToken;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      0,
      "Cannot reach the API. Check that the backend is running and VITE_API_BASE_URL is correct."
    );
  }

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

    /** Optional accessToken avoids getSession() inside onAuthStateChange (deadlock). */
    me: (accessToken?: string) =>
      request<AuthSession["user"]>("/auth/me", { accessToken }),
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

    listMembers: (teamId: string) =>
      request<TeamMemberWithUser[]>(`/teams/${teamId}/members`),
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

  chat: {
    listChannels: (teamId: string) =>
      request<ChatChannel[]>(`/teams/${teamId}/channels`),

    createChannel: (teamId: string, payload: ChatChannelCreate) =>
      request<ChatChannel>(`/teams/${teamId}/channels`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    startDm: (teamId: string, payload: ChatDirectMessageCreate) =>
      request<ChatChannel>(`/teams/${teamId}/dms`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    createGroup: (teamId: string, payload: ChatGroupCreate) =>
      request<ChatChannel>(`/teams/${teamId}/groups`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    listMessages: (
      teamId: string,
      channelId: string,
      opts: { limit?: number; before?: string; after?: string } = {}
    ) => {
      const params = new URLSearchParams();
      if (opts.limit != null) params.set("limit", String(opts.limit));
      if (opts.before) params.set("before", opts.before);
      if (opts.after) params.set("after", opts.after);
      const query = params.toString();
      return request<ChatMessagePage>(
        `/teams/${teamId}/channels/${channelId}/messages${query ? `?${query}` : ""}`
      );
    },

    sendMessage: (
      teamId: string,
      channelId: string,
      payload: ChatMessageCreate
    ) =>
      request<ChatMessage>(
        `/teams/${teamId}/channels/${channelId}/messages`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      ),
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
