import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendError, AuthError } from './_lib/auth';
import { getProjects, getProjectById, upsertProject, deleteProject } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const claims = await requireAuth(req, 'teacher');

    if (req.method === 'GET') {
      const projects = await getProjects(claims.email);
      return res.status(200).json({ projects });
    }

    if (req.method === 'POST') {
      const project = req.body?.project;
      if (!project || !project.id) throw new AuthError(400, 'project가 필요합니다.');
      const ok = await upsertProject(project, claims.email);
      return res.status(200).json({ ok, project });
    }

    if (req.method === 'DELETE') {
      const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
      if (!id) throw new AuthError(400, 'id가 필요합니다.');

      const existing = await getProjectById(id);
      if (!existing) throw new AuthError(404, '프로젝트를 찾을 수 없습니다.');
      if (existing.teacher_email !== claims.email) {
        throw new AuthError(403, '본인 소유가 아닌 프로젝트는 삭제할 수 없습니다.');
      }

      const ok = await deleteProject(id);
      return res.status(200).json({ ok });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
