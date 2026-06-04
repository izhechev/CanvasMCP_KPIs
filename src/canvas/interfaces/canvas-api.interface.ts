export interface CanvasEnrollment {
  course_id: number;
  course?: { name: string; course_code: string };
  grades?: { current_score: number | null; current_grade: string | null };
  last_activity_at: string | null;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  created_at: string;
  enrollments?: Array<{
    type: string;
    computed_current_score: number | null;
    computed_current_grade: string | null;
  }>;
  start_at: string | null;
  end_at: string | null;
}

export interface CanvasRubricCriterion {
  id: string;
  description: string;
  ratings: Array<{ id: string; points: number; description: string }>;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  submission_types: string[];
  description: string | null;
  rubric?: CanvasRubricCriterion[];
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  posted_at: string;
  author: { display_name: string } | null;
  message: string;
  html_url: string;
}

export interface CanvasSubmission {
  assignment_id: number;
  course_id?: number;
  attempt: number | null;
  graded_at: string | null;
  assignment?: CanvasAssignment;
  submitted_at: string | null;
  score: number | null;
  grade: string | null;
  workflow_state?: string;
  submission_comments?: Array<{ comment: string; author_name: string }>;
  rubric_assessment?: Record<string, { points: number; description?: string }>;
}

export interface CanvasCalendarEvent {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  description: string | null;
  html_url: string;
  context_code: string;
  type: string;
}

export interface CanvasConversation {
  id: number;
  subject: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
  workflow_state: string;
  context_name: string | null;
  participants: Array<{ name: string }>;
}

export interface CanvasConversationDetail {
  messages: Array<{ body: string; author_id: number; created_at: string }>;
}
