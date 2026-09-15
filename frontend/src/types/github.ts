/** GitHub activity types returned by `/api/v1/github/*`. */

export interface GitHubActivityItem {
  id: string;
  event_type: string;
  action: string | null;
  title: string;
  body_preview: string | null;
  repo_full_name: string | null;
  actor_login: string | null;
  html_url: string | null;
  task_keys: string[];
  installation_id: string | null;
  delivery_id: string | null;
  received_at: string;
}

export interface GitHubStatus {
  configured: boolean;
  app_id_set: boolean;
  webhook_secret_set: boolean;
  private_key_loaded: boolean;
  installation_id_set: boolean;
  installation_reachable: boolean | null;
  connected: boolean;
  installation_id: string | null;
  account_login: string | null;
  account_type: string | null;
  repositories: string[];
  repository_selection: string | null;
  team_id: string | null;
  user_id: string | null;
  source: string | null;
  detail: string | null;
}

export interface GitHubConnect {
  url: string;
  state: string;
  app_slug: string | null;
  requires_session: boolean;
  detail: string | null;
}
