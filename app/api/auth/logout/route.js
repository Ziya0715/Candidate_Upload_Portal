import { jsonOk } from '@/lib/http';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';
import { TEAM_COOKIE, teamCookieOptions } from '@/lib/team/session';

export const runtime = 'nodejs';

export async function POST(request) {
  const host = request.headers.get('host') || '';
  const response = jsonOk({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(host), maxAge: 0 });
  response.cookies.set(TEAM_COOKIE, '', { ...teamCookieOptions(host), maxAge: 0 });
  return response;
}
