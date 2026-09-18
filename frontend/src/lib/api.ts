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
  DocumentCreate,
  DocumentRevision,
  DocumentUpdate,
  GitHubActivityItem,
  GitHubConnect,
  GitHubStatus,
  Invite,
  InviteAcceptResponse,
  InviteCreate,
  LoginRequest,
  MeetingCreateRequest,
  MeetingRecap,
  Organization,
  OrganizationCreate,
  RecapGenerateRequest,
  RecapSendRequest,
  RecapUpdateRequest,
  RegisterRequest,
  Task,
  TaskCreate,
  TaskStatus,
  TaskStatusUpdate,
  TaskUpdate,
  Team,
  TeamCreate,
  TeamDocument,
  TeamDocumentSummary,
  TeamMeeting,
  TeamMemberWithUser,
  TimeEntry,
  TimeEntryCreate,
  TimeEntryListParams,
  TimeEntryUpdate,
} from "@/types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

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
  if (!API_BASE) {
    throw new ApiError(
      0,
      "VITE_API_BASE_URL is not set. Add it in frontend/.env (local) or Cloudflare Pages env, then rebuild."
    );
  }

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

  recaps: {
    list: (teamId: string) =>
      request<MeetingRecap[]>(`/teams/${teamId}/recaps`),

    get: (teamId: string, recapId: string) =>
      request<MeetingRecap>(`/teams/${teamId}/recaps/${recapId}`),

    generate: (teamId: string, payload: RecapGenerateRequest) =>
      request<MeetingRecap>(`/teams/${teamId}/recaps/generate`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    update: (teamId: string, recapId: string, payload: RecapUpdateRequest) =>
      request<MeetingRecap>(`/teams/${teamId}/recaps/${recapId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    send: (teamId: string, recapId: string, payload: RecapSendRequest = {}) =>
      request<MeetingRecap>(`/teams/${teamId}/recaps/${recapId}/send`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  meetings: {
    list: (teamId: string) =>
      request<TeamMeeting[]>(`/teams/${teamId}/meetings`),

    create: (teamId: string, payload: MeetingCreateRequest) =>
      request<TeamMeeting>(`/teams/${teamId}/meetings`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    get: (teamId: string, meetingId: string) =>
      request<TeamMeeting>(`/teams/${teamId}/meetings/${meetingId}`),

    end: (teamId: string, meetingId: string) =>
      request<TeamMeeting>(`/teams/${teamId}/meetings/${meetingId}/end`, {
        method: "POST",
        body: JSON.stringify({}),
      }),

    transcribe: async (teamId: string, meetingId: string, file: File) => {
      const token = await getAccessToken();
      const form = new FormData();
      form.append("file", file);
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      let response: Response;
      try {
        response = await fetch(
          `${API_BASE}/teams/${teamId}/meetings/${meetingId}/transcribe`,
          { method: "POST", headers, body: form }
        );
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
      return response.json() as Promise<{ transcript: string }>;
    },

    recap: (teamId: string, meetingId: string, transcript: string) =>
      request<MeetingRecap>(`/teams/${teamId}/meetings/${meetingId}/recap`, {
        method: "POST",
        body: JSON.stringify({ transcript }),
      }),
  },

  timesheets: {
    list: (teamId: string, params: TimeEntryListParams = {}) => {
      const search = new URLSearchParams();
      if (params.user_id) search.set("user_id", params.user_id);
      if (params.task_id) search.set("task_id", params.task_id);
      if (params.date_from) search.set("date_from", params.date_from);
      if (params.date_to) search.set("date_to", params.date_to);
      const query = search.toString();
      return request<TimeEntry[]>(
        `/teams/${teamId}/timesheets${query ? `?${query}` : ""}`
      );
    },

    create: (teamId: string, payload: TimeEntryCreate) =>
      request<TimeEntry>(`/teams/${teamId}/timesheets`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    update: (teamId: string, entryId: string, payload: TimeEntryUpdate) =>
      request<TimeEntry>(`/teams/${teamId}/timesheets/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    delete: (teamId: string, entryId: string) =>
      request<void>(`/teams/${teamId}/timesheets/${entryId}`, {
        method: "DELETE",
      }),
  },

  docs: {
    list: (teamId: string) =>
      request<TeamDocumentSummary[]>(`/teams/${teamId}/docs`),

    get: (teamId: string, documentId: string) =>
      request<TeamDocument>(`/teams/${teamId}/docs/${documentId}`),

    create: (teamId: string, payload: DocumentCreate) =>
      request<TeamDocument>(`/teams/${teamId}/docs`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    update: (teamId: string, documentId: string, payload: DocumentUpdate) =>
      request<TeamDocument>(`/teams/${teamId}/docs/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    delete: (teamId: string, documentId: string) =>
      request<void>(`/teams/${teamId}/docs/${documentId}`, {
        method: "DELETE",
      }),

    history: (teamId: string, documentId: string) =>
      request<DocumentRevision[]>(
        `/teams/${teamId}/docs/${documentId}/history`
      ),

    getRevision: (teamId: string, documentId: string, revisionId: string) =>
      request<DocumentRevision>(
        `/teams/${teamId}/docs/${documentId}/history/${revisionId}`
      ),

    restore: (teamId: string, documentId: string, revisionId: string) =>
      request<TeamDocument>(
        `/teams/${teamId}/docs/${documentId}/restore/${revisionId}`,
        { method: "POST", body: JSON.stringify({}) }
      ),
  },
};

export { ApiError };
