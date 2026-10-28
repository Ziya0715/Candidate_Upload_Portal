import { jsonOk } from '@/lib/http';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';
import { assertTeamWrite, TEAM_COOKIE, teamCookieOptions } from '@/lib/team/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    assertTeamWrite(request);
    const host = request.headers.get('host') || '';
    const response = jsonOk({ ok: true });
    response.cookies.set(TEAM_COOKIE, '', { ...teamCookieOptions(host), maxAge: 0 });
    response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(host), maxAge: 0 });
    return response;
  } catch (error) {
    return jsonOk({ ok: true });
  }
}
