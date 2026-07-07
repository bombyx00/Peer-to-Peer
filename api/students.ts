import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendError, AuthError } from './_lib/auth';
import { getRosters, getStudentsForRosterIds, upsertStudents } from './_lib/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const claims = await requireAuth(req, 'teacher');

    if (req.method === 'GET') {
      const rosters = await getRosters(claims.email);
      const students = await getStudentsForRosterIds(rosters.map((r: any) => r.id));
      return res.status(200).json({ students });
    }

    if (req.method === 'POST') {
      const students = req.body?.students;
      if (!Array.isArray(students)) throw new AuthError(400, 'students 배열이 필요합니다.');

      // Defense in depth: reject writes into a roster this teacher doesn't own.
      const rosters = await getRosters(claims.email);
      const ownedRosterIds = new Set(rosters.map((r: any) => r.id));
      ownedRosterIds.add('roster-default');
      for (const s of students) {
        const rosterId = s.rosterId || 'roster-default';
        if (!ownedRosterIds.has(rosterId)) {
          throw new AuthError(403, '본인 소유가 아닌 명단에는 학생을 등록할 수 없습니다.');
        }
      }

      const ok = await upsertStudents(students);
      return res.status(200).json({ ok });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
