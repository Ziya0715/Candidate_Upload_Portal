import 'server-only';
import { getSession } from './auth';
import { canOpenUpload, getActor } from './team/guard';

export async function requireUploadDesk() {
  const session = await getSession();
  if (session) return session;
  try {
    const actor = await getActor();
    if (actor && canOpenUpload(actor)) return { username: actor.name };
    if (actor) {
      const error = new Error('The upload desk is only available to the RA team.');
      error.status = 403;
      throw error;
    }
  } catch (error) {
    if (error?.status === 403) throw error;
  }
  const error = new Error('Please log in.');
  error.status = 401;
  throw error;
}

export async function uploadDeskPageAccess() {
  const session = await getSession();
  if (session) return { username: session.username };
  try {
    const actor = await getActor();
    if (actor && canOpenUpload(actor)) return { username: actor.name, team: true };
    if (actor) return { denied: true };
  } catch {
    return null;
  }
  return null;
}
