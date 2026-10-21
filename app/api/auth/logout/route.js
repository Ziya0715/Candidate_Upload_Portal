import { jsonOk } from '@/lib/http';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(request) {
  const response = jsonOk({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', {
    ...sessionCookieOptions(request.headers.get('host')),
    maxAge: 0,
  });
  return response;
}
