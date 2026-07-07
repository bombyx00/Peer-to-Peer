import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyGoogleIdToken, signSessionToken, sendError, AuthError } from './_lib/auth.js';
import { isSupabaseConfigured, getActiveProjectByAccessCode, findStudentByDetails } from './_lib/supabase.js';

const INVALID_STUDENT_LOGIN_MESSAGE = '유효하지 않거나 비활성화된 인증번호입니다.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};

    if (body.mode === 'teacher') {
      const { googleIdToken } = body;
      if (!googleIdToken || typeof googleIdToken !== 'string') {
        throw new AuthError(400, 'googleIdToken이 필요합니다.');
      }
      const { email, name } = await verifyGoogleIdToken(googleIdToken);
      const token = await signSessionToken({ role: 'teacher', email, name }, '24h');
      return res.status(200).json({ token, role: 'teacher', email, name });
    }

    if (body.mode === 'student') {
      if (!isSupabaseConfigured()) {
        throw new AuthError(503, '서버에 Supabase가 설정되지 않았습니다.');
      }
      const { accessCode, grade, classNum, number, name } = body;
      if (!accessCode || !grade || !classNum || !number || !name) {
        throw new AuthError(400, '모든 로그인 정보를 입력해주세요.');
      }

      const project = await getActiveProjectByAccessCode(String(accessCode).trim());
      if (!project) {
        throw new AuthError(401, INVALID_STUDENT_LOGIN_MESSAGE);
      }

      const rosterId = project.roster_id || 'roster-default';
      const student = await findStudentByDetails(
        String(grade).trim(),
        String(classNum).trim(),
        String(number).trim(),
        String(name).trim(),
        rosterId
      );
      if (!student) {
        throw new AuthError(401, INVALID_STUDENT_LOGIN_MESSAGE);
      }

      const teacherEmail = project.teacher_email;
      const token = await signSessionToken(
        { role: 'student', studentId: student.id, projectId: project.id, teacherEmail },
        '24h'
      );

      return res.status(200).json({
        token,
        role: 'student',
        studentId: student.id,
        projectId: project.id,
        teacherEmail,
        studentInfo: {
          id: student.id,
          grade: student.grade,
          classNum: student.classNum,
          number: student.number,
          name: student.name,
          email: student.email,
          rosterId: student.roster_id || 'roster-default',
        },
      });
    }

    throw new AuthError(400, 'mode는 teacher 또는 student여야 합니다.');
  } catch (err) {
    return sendError(res, err);
  }
}
