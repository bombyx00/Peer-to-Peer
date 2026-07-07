/**
 * Server-only auth helpers.
 * - Verifies Google ID tokens against Google's JWKS (real signature/issuer/audience check,
 *   unlike the old client-side base64-only decode).
 * - Signs/verifies our own short-lived app session JWTs (HS256) so we don't need to
 *   re-verify a Google token on every request.
 */
import { jwtVerify, SignJWT, createRemoteJWKSet } from 'jose';

// Module-scoped so warm serverless containers reuse the JWKS cache instead of
// re-fetching Google's public keys on every request.
const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

const appSecret = () => new TextEncoder().encode(process.env.APP_JWT_SECRET || '');

export interface TeacherClaims {
  role: 'teacher';
  email: string;
  name: string;
}

export interface StudentClaims {
  role: 'student';
  studentId: string;
  projectId: string;
  teacherEmail: string;
}

export type SessionClaims = TeacherClaims | StudentClaims;

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const verifyGoogleIdToken = async (idToken: string): Promise<{ email: string; name: string }> => {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  if (!clientId) throw new AuthError(500, '서버에 GOOGLE_CLIENT_ID가 설정되지 않았습니다.');

  let payload: any;
  try {
    const result = await jwtVerify(idToken, googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });
    payload = result.payload;
  } catch {
    throw new AuthError(401, '구글 로그인 검증에 실패했습니다.');
  }

  if (payload.email_verified === false || !payload.email) {
    throw new AuthError(401, '구글 로그인 검증에 실패했습니다.');
  }

  return { email: String(payload.email), name: String(payload.name || '교사') };
};

export const signSessionToken = async (claims: SessionClaims, expiresIn: string): Promise<string> => {
  return new SignJWT({ ...claims } as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(appSecret());
};

export const verifySessionToken = async (token: string): Promise<SessionClaims> => {
  try {
    const { payload } = await jwtVerify(token, appSecret());
    return payload as unknown as SessionClaims;
  } catch {
    throw new AuthError(401, '세션이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.');
  }
};

const extractBearerToken = (req: { headers: Record<string, any> }): string => {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
    throw new AuthError(401, '인증 토큰이 필요합니다.');
  }
  return header.slice('Bearer '.length).trim();
};

export async function requireAuth(
  req: { headers: Record<string, any> },
  role: 'teacher'
): Promise<TeacherClaims>;
export async function requireAuth(
  req: { headers: Record<string, any> },
  role: 'student'
): Promise<StudentClaims>;
export async function requireAuth(req: { headers: Record<string, any> }): Promise<SessionClaims>;
export async function requireAuth(
  req: { headers: Record<string, any> },
  role?: 'teacher' | 'student'
): Promise<SessionClaims> {
  const token = extractBearerToken(req);
  const claims = await verifySessionToken(token);
  if (role && claims.role !== role) {
    throw new AuthError(403, '이 작업을 수행할 권한이 없습니다.');
  }
  return claims;
}

// Shared error responder for route handlers: AuthError carries its own status,
// anything else is an unexpected 500.
export const sendError = (res: any, err: unknown) => {
  if (err instanceof AuthError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
};
