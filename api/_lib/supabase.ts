/**
 * Server-only Supabase access using the service_role key.
 * Mirrors the query shapes that used to live in src/services/supabase.ts,
 * including the 400-fallback retries for older schema variants, but is
 * never reachable from the browser (service_role key lives only in this
 * serverless function's environment).
 */

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = () => supabaseUrl !== '' && serviceRoleKey !== '';

const sbHeaders = (extra?: Record<string, string>) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
  ...extra,
});

const sbFetch = (path: string, init?: RequestInit) =>
  fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...sbHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });

const sbJson = <T = any>(res: Response): Promise<T> => res.json() as Promise<T>;

// ---- rosters ----

export const getRosters = async (teacherEmail: string): Promise<any[]> => {
  const res = await sbFetch(`rosters?teacher_email=eq.${encodeURIComponent(teacherEmail)}`);
  if (!res.ok) return [];
  return sbJson<any[]>(res);
};

export const upsertRosters = async (rosters: any[], teacherEmail: string): Promise<boolean> => {
  const payload = rosters.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    teacher_email: teacherEmail,
  }));
  const res = await sbFetch('rosters', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(payload),
  });
  return res.ok;
};

// ---- students ----

export const getStudentsForRosterIds = async (rosterIds: string[]): Promise<any[]> => {
  if (rosterIds.length === 0) return [];
  const res = await sbFetch(`students?roster_id=in.(${encodeURIComponent(rosterIds.join(','))})`);
  if (!res.ok) return [];
  return sbJson<any[]>(res);
};

export const upsertStudents = async (students: any[]): Promise<boolean> => {
  const buildPayload = (includeRoster: boolean) =>
    students.map((s) => {
      const payload: any = {
        id: s.id,
        grade: s.grade,
        classNum: s.classNum,
        number: s.number,
        name: s.name,
        email: s.email,
      };
      if (includeRoster) payload.roster_id = s.rosterId || 'roster-default';
      return payload;
    });

  let res = await sbFetch('students', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(buildPayload(true)),
  });

  if (res.status === 400) {
    res = await sbFetch('students', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(buildPayload(false)),
    });
  }

  return res.ok;
};

export const findStudentByDetails = async (
  grade: string,
  classNum: string,
  number: string,
  name: string,
  rosterId: string
): Promise<any | null> => {
  const res = await sbFetch(
    `students?grade=eq.${encodeURIComponent(grade)}&classNum=eq.${encodeURIComponent(classNum)}&number=eq.${encodeURIComponent(number)}&name=eq.${encodeURIComponent(name)}&roster_id=eq.${encodeURIComponent(rosterId)}`
  );
  if (!res.ok) return null;
  const data = await sbJson<any[]>(res);
  return data.length > 0 ? data[0] : null;
};

// ---- projects ----

export const getProjects = async (teacherEmail: string): Promise<any[]> => {
  const res = await sbFetch(`projects?teacher_email=eq.${encodeURIComponent(teacherEmail)}`);
  if (res.ok) {
    const data = await sbJson<any[]>(res);
    if (data.length > 0) return data;
  }
  return [];
};

export const getProjectById = async (projectId: string): Promise<any | null> => {
  const res = await sbFetch(`projects?id=eq.${encodeURIComponent(projectId)}`);
  if (!res.ok) return null;
  const data = await sbJson<any[]>(res);
  return data.length > 0 ? data[0] : null;
};

export const getActiveProjectByAccessCode = async (accessCode: string): Promise<any | null> => {
  const res = await sbFetch(`projects?accessCode=eq.${encodeURIComponent(accessCode)}&active=eq.true`);
  if (!res.ok) return null;
  const data = await sbJson<any[]>(res);
  return data.length > 0 ? data[0] : null;
};

export const upsertProject = async (project: any, teacherEmail: string): Promise<boolean> => {
  const buildPayload = (includeRoster: boolean) => {
    const payload: any = {
      id: project.id,
      title: project.title,
      description: project.description,
      questions: typeof project.questions === 'string' ? project.questions : JSON.stringify(project.questions),
      selfEvalEnabled: project.selfEvalEnabled,
      groups: typeof project.groups === 'string' ? project.groups : JSON.stringify(project.groups),
      active: project.active,
      createdAt: project.createdAt,
      accessCode: project.accessCode,
      teacher_email: teacherEmail,
    };
    if (includeRoster) payload.roster_id = project.rosterId || 'roster-default';
    return payload;
  };

  let res = await sbFetch('projects', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(buildPayload(true)),
  });

  if (res.status === 400) {
    res = await sbFetch('projects', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(buildPayload(false)),
    });
  }

  return res.ok;
};

export const deleteProject = async (projectId: string): Promise<boolean> => {
  const res = await sbFetch(`projects?id=eq.${encodeURIComponent(projectId)}`, { method: 'DELETE' });
  return res.ok;
};

// ---- evaluations ----

export const getEvaluationsForProjectIds = async (projectIds: string[]): Promise<any[]> => {
  if (projectIds.length === 0) return [];
  const res = await sbFetch(`evaluations?project_id=in.(${encodeURIComponent(projectIds.join(','))})`);
  if (!res.ok) return [];
  return sbJson<any[]>(res);
};

export const getEvaluationsForStudent = async (projectId: string, evaluatorId: string): Promise<any[]> => {
  const res = await sbFetch(
    `evaluations?project_id=eq.${encodeURIComponent(projectId)}&evaluator_id=eq.${encodeURIComponent(evaluatorId)}`
  );
  if (!res.ok) return [];
  return sbJson<any[]>(res);
};

export const deleteEvaluation = async (
  projectId: string,
  evaluatorId: string,
  evaluateeId: string
): Promise<boolean> => {
  const res = await sbFetch(
    `evaluations?project_id=eq.${encodeURIComponent(projectId)}&evaluator_id=eq.${encodeURIComponent(evaluatorId)}&evaluatee_id=eq.${encodeURIComponent(evaluateeId)}`,
    { method: 'DELETE' }
  );
  return res.ok;
};

export const insertEvaluation = async (evaluation: any): Promise<boolean> => {
  let res = await sbFetch('evaluations', {
    method: 'POST',
    body: JSON.stringify(evaluation),
  });

  if (!res.ok && res.status === 400 && 'teacher_email' in evaluation) {
    const errData: any = await res.json().catch(() => ({}));
    if (String(errData.message || '').includes('teacher_email')) {
      const { teacher_email: _teacher_email, ...fallbackPayload } = evaluation;
      res = await sbFetch('evaluations', {
        method: 'POST',
        body: JSON.stringify(fallbackPayload),
      });
    }
  }

  return res.ok;
};

// Upsert-by-replace: delete any existing row for this (project, evaluator, evaluatee) then insert.
export const submitEvaluation = async (evaluation: {
  project_id: string;
  evaluator_id: string;
  evaluatee_id: string;
  answers: string;
  ai_feedback?: string;
  submitted_at: string;
  teacher_email: string;
}): Promise<boolean> => {
  await deleteEvaluation(evaluation.project_id, evaluation.evaluator_id, evaluation.evaluatee_id);
  return insertEvaluation(evaluation);
};

// ---- scoped wipe (replaces old clearAllCloudData) ----

export const wipeTeacherData = async (teacherEmail: string): Promise<boolean> => {
  const encodedEmail = encodeURIComponent(teacherEmail);

  const projects = await getProjects(teacherEmail);
  const projectIds = projects.map((p: any) => p.id);

  const rosters = await getRosters(teacherEmail);
  const rosterIds = rosters.map((r: any) => r.id);

  const resEval = projectIds.length
    ? await sbFetch(`evaluations?project_id=in.(${encodeURIComponent(projectIds.join(','))})`, { method: 'DELETE' })
    : ({ ok: true } as Response);

  const resStud = rosterIds.length
    ? await sbFetch(`students?roster_id=in.(${encodeURIComponent(rosterIds.join(','))})`, { method: 'DELETE' })
    : ({ ok: true } as Response);

  const resProj = await sbFetch(`projects?teacher_email=eq.${encodedEmail}`, { method: 'DELETE' });
  const resRoster = await sbFetch(`rosters?teacher_email=eq.${encodedEmail}`, { method: 'DELETE' });

  return resProj.ok && resStud.ok && resEval.ok && resRoster.ok;
};
