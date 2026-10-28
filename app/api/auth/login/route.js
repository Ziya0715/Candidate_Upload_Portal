import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { secretsMatch } from '@/lib/auth';
import { staffPassword, staffUsername } from '@/lib/defaults';
import { fail, httpError, jsonOk, readBody } from '@/lib/http';
import { clearLoginFailures, loginBlocked, recordLoginFailure } from '@/lib/loginAttempts';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';
import { teamQuery } from '@/lib/team/db';
import { createTeamToken, TEAM_COOKIE, teamCookieOptions } from '@/lib/team/session';

export const runtime = 'nodejs';

function clientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 80) || 'unknown';
  return 'local';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function teamLogin(email, password) {
  try {
    const recent = await teamQuery(
      'SELECT COUNT(*) AS total FROM tm_login_attempts WHERE email = ? AND attempted_at > DATE_SUB(NOW(3), INTERVAL 10 MINUTE)',
      [email]
    );
    if (Number(recent[0]?.total || 0) >= 8) return { limited: true };
    const rows = await teamQuery('SELECT id, password_hash, is_active FROM tm_users WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    if (!user) return { user: null };
    if (!user.is_active) return { user, inactive: true };
    const matches = await bcrypt.compare(password, user.password_hash);
    return { user, matches };
  } catch {
    return null;
  }
}

async function recordTeamFailure(email) {
  try {
    await teamQuery('INSERT INTO tm_login_attempts (id, email, attempted_at) VALUES (?,?,?)', [crypto.randomUUID(), email, new Date()]);
  } catch {
    // Staff login still works when the team database is unavailable.
  }
}

export async function POST(request) {
  const key = clientKey(request);

  try {
    const username = staffUsername();
    const password = staffPassword();

    if (process.env.NODE_ENV === 'production' && password === 'change-this-password') {
      throw httpError('Change STAFF_PASSWORD before running this app in production.', 500);
    }

    if (loginBlocked(key)) {
      throw httpError('Too many login attempts. Wait a few minutes and try again.', 429);
    }

    const body = await readBody(request);
    const givenLogin = typeof body?.email === 'string' ? body.email : body?.username;
    const givenPassword = body?.password;
    const shapeIsValid =
      typeof givenLogin === 'string' &&
      typeof givenPassword === 'string' &&
      givenLogin.trim().length > 0 &&
      givenLogin.trim().length <= 190 &&
      givenPassword.length > 0 &&
      givenPassword.length <= 200;
    const login = shapeIsValid ? givenLogin.trim() : '';
    const email = login.toLowerCase();

    const staffMatches =
      shapeIsValid &&
      login.length <= 80 &&
      secretsMatch(login, username) &&
      secretsMatch(givenPassword, password);
    const team = shapeIsValid ? await teamLogin(email, givenPassword) : null;

    if (team?.limited && !staffMatches) {
      throw httpError('Too many login attempts. Wait a few minutes and try again.', 429);
    }

    if (!staffMatches && !team?.matches) {
      await delay(500);
      if (shapeIsValid) await recordTeamFailure(email);
      if (recordLoginFailure(key)) {
        throw httpError('Too many login attempts. Wait a few minutes and try again.', 429);
      }
      throw httpError(team?.inactive ? 'This account is deactivated.' : 'Incorrect email or password.', 401);
    }

    clearLoginFailures(key);
    const response = jsonOk({ ok: true, redirect: team?.matches ? '/team' : '/dashboard' });
    const host = request.headers.get('host') || '';
    if (team?.matches) {
      response.cookies.set(TEAM_COOKIE, await createTeamToken(team.user.id), teamCookieOptions(host));
    }
    if (staffMatches) {
      response.cookies.set(SESSION_COOKIE, await createSessionToken(username), sessionCookieOptions(host));
    }
    return response;
  } catch (error) {
    return fail(error);
  }
}
