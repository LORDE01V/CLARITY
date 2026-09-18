/** Task types matching backend app.models.task */

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  story_points: number | null;
  parent_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  assignee_id?: string | null;
  due_date?: string | null;
  position?: number | null;
  story_points?: number | null;
  parent_task_id?: string | null;
}

export interface TaskUpdate {
  title?: string | null;
  description?: string | null;
  assignee_id?: string | null;
  due_date?: string | null;
  position?: number | null;
  story_points?: number | null;
  parent_task_id?: string | null;
}

export interface TaskStatusUpdate {
  status: TaskStatus;
  position?: number | null;
}
