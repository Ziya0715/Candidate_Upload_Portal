import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { teamQuery } from '@/lib/team/db';
import { createTeamToken, TEAM_COOKIE, teamCookieOptions } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await readBody(request);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password || email.length > 190 || password.length > 200) {
      throw httpError('Enter your email and password.');
    }
    const recent = await teamQuery(
      'SELECT COUNT(*) AS total FROM tm_login_attempts WHERE email = ? AND attempted_at > DATE_SUB(NOW(3), INTERVAL 10 MINUTE)',
      [email]
    );
    if (Number(recent[0]?.total || 0) >= 8) throw httpError('Too many attempts. Try again in a few minutes.', 429);
    const rows = await teamQuery('SELECT id, password_hash, is_active FROM tm_users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    const matches = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !user.is_active || !matches) {
      await teamQuery('INSERT INTO tm_login_attempts (id, email, attempted_at) VALUES (?,?,?)', [crypto.randomUUID(), email, new Date()]);
      throw httpError(user && !user.is_active ? 'This account is deactivated.' : 'Incorrect email or password.', 401);
    }
    const token = await createTeamToken(user.id);
    const response = jsonOk({ ok: true });
    response.cookies.set(TEAM_COOKIE, token, teamCookieOptions(request.headers.get('host') || ''));
    return response;
  } catch (error) {
    return fail(error);
  }
}
