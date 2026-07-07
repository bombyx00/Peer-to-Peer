/**
 * Client bridge to the app's own /api/* serverless functions.
 * Replaces the old direct-to-Supabase calls (src/services/supabase.ts) — the
 * browser no longer talks to Supabase or Gemini directly, and never holds a
 * database key. Every call here is authenticated with the app-issued session
 * token minted by /api/auth after server-side identity verification.
 */

const SESSION_KEY = 'peer_eval_session';

export interface TeacherSession {
  token: string;
  role: 'teacher';
  email: string;
  name: string;
}

export interface StudentSession {
  token: string;
  role: 'student';
  studentId: string;
  projectId: string;
  teacherEmail: string;
  studentInfo: {
    id: string;
    grade: string;
    classNum: string;
    number: string;
    name: string;
    email: string;
    rosterId: string;
  };
}

export type Session = TeacherSession | StudentSession;

export const getSession = (): Session | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setSession = (session: Session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const apiFetch = async (path: string, init?: RequestInit) => {
  const session = getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (session?.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }

  const res = await fetch(path, { ...init, headers });

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new Event('session-expired'));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || `요청 실패 (${res.status})`);
  }

  return res.json();
};

// ---- auth ----

export const apiLoginTeacher = async (googleIdToken: string): Promise<TeacherSession> => {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'teacher', googleIdToken }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error || '구글 로그인에 실패했습니다.');
  return body;
};

export const apiLoginStudent = async (
  accessCode: string,
  grade: string,
  classNum: string,
  number: string,
  name: string
): Promise<StudentSession> => {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'student', accessCode, grade, classNum, number, name }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error || '로그인에 실패했습니다.');
  return body;
};

// ---- health ----

export const checkHealth = async (): Promise<{ supabase: boolean; gemini: boolean }> => {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { supabase: false, gemini: false };
    return res.json();
  } catch {
    return { supabase: false, gemini: false };
  }
};

// ---- rosters ----

export const fetchRosters = async (): Promise<any[]> => {
  const { rosters } = await apiFetch('/api/rosters');
  return rosters;
};

export const syncRosters = async (rosters: any[]): Promise<boolean> => {
  const { ok } = await apiFetch('/api/rosters', { method: 'POST', body: JSON.stringify({ rosters }) });
  return ok;
};

// ---- students ----

export const fetchStudents = async (): Promise<any[]> => {
  const { students } = await apiFetch('/api/students');
  return students;
};

export const syncStudents = async (students: any[]): Promise<boolean> => {
  const { ok } = await apiFetch('/api/students', { method: 'POST', body: JSON.stringify({ students }) });
  return ok;
};

// ---- projects ----

export const fetchProjects = async (): Promise<any[]> => {
  const { projects } = await apiFetch('/api/projects');
  return projects;
};

export const syncProject = async (project: any): Promise<boolean> => {
  const { ok } = await apiFetch('/api/projects', { method: 'POST', body: JSON.stringify({ project }) });
  return ok;
};

export const deleteProjectApi = async (id: string): Promise<boolean> => {
  const { ok } = await apiFetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  return ok;
};

// ---- student context (own project + own group's students) ----

export const fetchStudentContext = async (): Promise<{ project: any; students: any[] }> => {
  return apiFetch('/api/student-context');
};

// ---- evaluations ----

export const fetchEvaluations = async (): Promise<any[]> => {
  const { evaluations } = await apiFetch('/api/evaluations');
  return evaluations;
};

export const submitEvaluationApi = async (payload: {
  projectId: string;
  evaluatorId: string;
  evaluateeId: string;
  answers: any;
  aiFeedback?: string;
}): Promise<boolean> => {
  const { ok } = await apiFetch('/api/evaluations', { method: 'POST', body: JSON.stringify(payload) });
  return ok;
};

// ---- reset ----

export const resetAllApi = async (): Promise<boolean> => {
  const { ok } = await apiFetch('/api/reset', { method: 'POST' });
  return ok;
};

// ---- gemini ----

export const fetchGeminiFeedback = async (payload: {
  projectTitle: string;
  questions: any[];
  evaluateeName: string;
  evaluations: any[];
  students: any[];
}): Promise<string> => {
  const { text } = await apiFetch('/api/gemini-feedback', { method: 'POST', body: JSON.stringify(payload) });
  return text;
};
