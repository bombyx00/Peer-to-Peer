import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const supabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  return res.status(200).json({ supabase, gemini });
}
