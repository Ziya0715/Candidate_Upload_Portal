import 'server-only';
import { getSession } from '../auth';
import { httpError } from '../http';
import { teamQuery } from './db';
import { readTeamSession } from './session';

export const RA_TEAM_NAME = 'RA Team';

const USER_SQL = `SELECT u.id, u.name, u.email, u.role, u.team_id, u.is_active, u.can_create_tasks, u.can_manage_members,
            t.name AS team_name
     FROM tm_users u
     LEFT JOIN tm_teams t ON t.id = u.team_id`;

function toActor(user) {
  if (!user || !user.is_active) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: user.team_id,
    teamName: user.team_name || '',
    canCreateTasks: Boolean(user.can_create_tasks),
    canManageMembers: Boolean(user.can_manage_members),
  };
}

export async function getActor() {
  const session = await readTeamSession();
  if (session) {
    const rows = await teamQuery(`${USER_SQL} WHERE u.id = ? LIMIT 1`, [session.userId]);
    const actor = toActor(rows[0]);
    if (actor) return actor;
  }
  const staff = await getSession();
  const email = String(staff?.username || '').trim().toLowerCase();
  if (!email) return null;
  const rows = await teamQuery(`${USER_SQL} WHERE u.email = ? LIMIT 1`, [email]);
  return toActor(rows[0]);
}

export async function requireActor() {
  const actor = await getActor();
  if (!actor) throw httpError('Please log in.', 401);
  return actor;
}

export function publicActor(actor) {
  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    role: actor.role,
    teamId: actor.teamId,
    teamName: actor.teamName,
    canCreateTasks: actor.canCreateTasks,
    canManageMembers: actor.canManageMembers,
    uploadDesk: actor.role === 'super_admin' || actor.teamName.trim().toLowerCase() === RA_TEAM_NAME.toLowerCase(),
  };
}

export function canOpenUpload(actor) {
  if (!actor) return false;
  return actor.role === 'super_admin' || String(actor.teamName || '').trim().toLowerCase() === RA_TEAM_NAME.toLowerCase();
}
