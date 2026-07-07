import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendError } from './_lib/auth.js';
import { wipeTeacherData } from './_lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const claims = await requireAuth(req, 'teacher');
    const ok = await wipeTeacherData(claims.email);
    return res.status(200).json({ ok });
  } catch (err) {
    return sendError(res, err);
  }
}
