export interface TimeEntry {
  id: string;
  team_id: string;
  user_id: string;
  task_id: string | null;
  work_date: string;
  minutes: number;
  hours: number;
  title: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryCreate {
  work_date: string;
  hours: number;
  task_id?: string | null;
  title?: string | null;
  description?: string | null;
}

export interface TimeEntryUpdate {
  work_date?: string;
  hours?: number;
  task_id?: string | null;
  title?: string | null;
  description?: string | null;
  clear_task?: boolean;
}

export interface TimeEntryListParams {
  user_id?: string;
  task_id?: string;
  date_from?: string;
  date_to?: string;
}
