import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendError, AuthError } from './_lib/auth.js';
import { getProjectById, getStudentsForRosterIds } from './_lib/supabase.js';

// Student-facing equivalent of api/projects.ts + api/students.ts: a logged-in
// student may only ever see their OWN project and the students in that
// project's roster (their group), never the teacher's full data set.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const claims = await requireAuth(req, 'student');

    const project = await getProjectById(claims.projectId);
    if (!project) throw new AuthError(404, '프로젝트를 찾을 수 없습니다.');

    const rosterId = project.roster_id || 'roster-default';
    const students = await getStudentsForRosterIds([rosterId]);

    return res.status(200).json({ project, students });
  } catch (err) {
    return sendError(res, err);
  }
}
