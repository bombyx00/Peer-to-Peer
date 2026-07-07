import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendError, AuthError } from './_lib/auth';
import { getProjects, getProjectById, getEvaluationsForProjectIds, getEvaluationsForStudent, submitEvaluation } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const claims = await requireAuth(req);

    if (req.method === 'GET') {
      if (claims.role === 'teacher') {
        const projects = await getProjects(claims.email);
        const evaluations = await getEvaluationsForProjectIds(projects.map((p: any) => p.id));
        return res.status(200).json({ evaluations });
      }
      // student: only their own submitted evaluations, never the whole teacher's data set
      const evaluations = await getEvaluationsForStudent(claims.projectId, claims.studentId);
      return res.status(200).json({ evaluations });
    }

    if (req.method === 'POST') {
      const { projectId, evaluatorId, evaluateeId, answers, aiFeedback } = req.body || {};
      if (!projectId || !evaluatorId || !evaluateeId) {
        throw new AuthError(400, 'projectId, evaluatorId, evaluateeId가 필요합니다.');
      }

      let teacherEmail: string;

      if (claims.role === 'student') {
        if (evaluatorId !== claims.studentId || projectId !== claims.projectId) {
          throw new AuthError(403, '본인 명의로만 평가를 제출할 수 있습니다.');
        }
        teacherEmail = claims.teacherEmail;
      } else {
        if (evaluatorId !== 'AI_SUMMARY') {
          throw new AuthError(403, '교사 계정은 AI 종합 총평만 제출할 수 있습니다.');
        }
        const project = await getProjectById(projectId);
        if (!project || project.teacher_email !== claims.email) {
          throw new AuthError(403, '본인 소유가 아닌 프로젝트에는 접근할 수 없습니다.');
        }
        teacherEmail = claims.email;
      }

      const ok = await submitEvaluation({
        project_id: projectId,
        evaluator_id: evaluatorId,
        evaluatee_id: evaluateeId,
        answers: JSON.stringify(answers || {}),
        ai_feedback: aiFeedback || '',
        submitted_at: new Date().toISOString(),
        teacher_email: teacherEmail,
      });
      return res.status(200).json({ ok });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
