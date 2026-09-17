export type RecapStatus = "draft" | "reviewed" | "sent";

export interface RecapActionItem {
  text: string;
  done: boolean;
}

export interface MeetingRecap {
  id: string;
  team_id: string;
  title: string;
  meeting_url: string | null;
  transcript: string;
  summary: string;
  action_items: RecapActionItem[];
  status: RecapStatus;
  model: string | null;
  created_by: string;
  reviewed_by: string | null;
  sent_channel_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecapGenerateRequest {
  title: string;
  transcript: string;
  meeting_url?: string | null;
}

export interface RecapUpdateRequest {
  title?: string;
  summary?: string;
  action_items?: RecapActionItem[];
  meeting_url?: string | null;
}

export interface RecapSendRequest {
  channel_id?: string | null;
}
