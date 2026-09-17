export type MeetingStatus = "scheduled" | "live" | "ended";

export interface TeamMeeting {
  id: string;
  team_id: string;
  title: string;
  room_name: string;
  meeting_url: string;
  status: MeetingStatus;
  created_by: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface MeetingCreateRequest {
  title: string;
}
