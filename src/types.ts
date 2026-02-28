export type Role = 'STUDENT' | 'TEACHER';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  class_code?: string;
  profile_photo?: string;
  program?: string;
  year?: string;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id?: number;
  content: string;
  timestamp: string;
  sender_name?: string;
}

export interface Assignment {
  id: number;
  title: string;
  description: string;
  deadline: string;
  materials?: string;
  max_points: number;
  submission_type: 'FILE' | 'TEXT' | 'BOTH';
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  teacher_id: number;
  teacher_name?: string;
  created_at: string;
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_id: number;
  student_name?: string;
  content?: string;
  points?: number;
  feedback?: string;
  file_path?: string;
  status: 'SUBMITTED' | 'PENDING' | 'GRADED';
  is_late: boolean;
  submitted_at: string;
  graded_at?: string;
  assignment_title?: string;
}

export interface Test {
  id: number;
  title: string;
  description: string;
  test_date?: string;
  duration: number;
  total_points: number;
  teacher_id: number;
  status: 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'IN_GRADING' | 'PUBLISHED';
  created_at: string;
}

export interface Question {
  id: number;
  test_id: number;
  content: string;
  type: 'MCQ' | 'OPEN';
  options?: string; // JSON string
  correct_answer?: string;
  points: number;
}

export interface TestAttempt {
  id: number;
  test_id: number;
  user_id: number;
  student_name?: string;
  test_title?: string;
  start_time: string;
  end_time?: string;
  status: 'STARTED' | 'SUBMITTED' | 'GRADED';
  total_score: number;
  feedback?: string;
}

export interface TestAnswer {
  id: number;
  attempt_id: number;
  question_id: number;
  answer_text: string;
  points_awarded: number;
  is_correct?: boolean;
  question_text?: string;
  question_type?: string;
  options?: string;
  max_points?: number;
  correct_answer?: string;
}
