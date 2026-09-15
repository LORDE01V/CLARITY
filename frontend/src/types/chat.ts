export interface ChatChannel {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_by: string;
  created_at: string;
}

export interface ChatChannelCreate {
  name: string;
  description?: string | null;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  author_id: string;
  author_email: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface ChatMessageCreate {
  body: string;
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  has_more: boolean;
}
