import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendError, AuthError } from './_lib/auth.js';
import { getRosters, upsertRosters } from './_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const claims = await requireAuth(req, 'teacher');

    if (req.method === 'GET') {
      const rosters = await getRosters(claims.email);
      return res.status(200).json({ rosters });
    }

    if (req.method === 'POST') {
      const rosters = req.body?.rosters;
      if (!Array.isArray(rosters)) throw new AuthError(400, 'rosters 배열이 필요합니다.');
      const ok = await upsertRosters(rosters, claims.email);
      return res.status(200).json({ ok });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return sendError(res, err);
  }
}
