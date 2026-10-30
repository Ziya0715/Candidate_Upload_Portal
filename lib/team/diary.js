import 'server-only';
import crypto from 'node:crypto';
import { httpError } from '../http';
import { todayInKolkata } from '../taskRules';
import { teamQuery } from './db';

function clean(value, label, max) {
  const text = String(value || '').trim();
  if (!text) throw httpError(`Enter a ${label}.`);
  if (text.length > max) throw httpError(`The ${label} must be ${max} characters or less.`);
  return text;
}

function diaryWhen(input) {
  const combined = String(input?.when || '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(combined);
  if (!match) throw httpError('Select a date and time.');
  const date = match[1];
  const time = match[2];
  const hour = Number(time.slice(0, 2));
  const minute = Number(time.slice(3, 5));
  if (hour > 23 || minute > 59) throw httpError('Select a date and time.');
  if (date > todayInKolkata()) throw httpError('Choose today or an earlier date.');
  return { date, time };
}

function preview(content) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 140) return text;
  return `${text.slice(0, 140).trim()}…`;
}

function present(row, actor) {
  const own = row.user_id === actor.id;
  return {
    id: row.id,
    userId: row.user_id,
    authorName: row.author_name || '',
    teamName: row.team_name || '',
    own,
    canEdit: own || actor.role === 'super_admin' || (actor.role === 'team_leader' && !!actor.teamId && row.user_team_id === actor.teamId),
    date: String(row.entry_date || '').slice(0, 10),
    time: String(row.entry_time || '').slice(0, 5),
    title: row.title,
    content: row.content,
    preview: preview(row.content),
    deleted: Boolean(row.deleted_at),
    deleteReason: row.delete_reason || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const DIARY_SELECT = `SELECT d.id, d.user_id, d.entry_date, d.entry_time, d.title, d.content, d.created_at, d.updated_at, d.deleted_at, d.delete_reason, u.name AS author_name, u.team_id AS user_team_id, tm.name AS team_name
  FROM tm_diary d
  JOIN tm_users u ON u.id = d.user_id
  LEFT JOIN tm_teams tm ON tm.id = u.team_id`;

export async function listDiary(actor) {
  const scope = actor.role === 'super_admin' ? 'all' : actor.role === 'team_leader' && actor.teamId ? 'team' : 'own';
  const rows = scope === 'all'
    ? await teamQuery(`${DIARY_SELECT} ORDER BY d.entry_date DESC, d.entry_time IS NULL, d.entry_time DESC, d.created_at DESC`)
    : scope === 'team'
      ? await teamQuery(`${DIARY_SELECT} WHERE u.team_id = ? OR d.user_id = ? ORDER BY d.entry_date DESC, d.entry_time IS NULL, d.entry_time DESC, d.created_at DESC`, [actor.teamId, actor.id])
      : await teamQuery(`${DIARY_SELECT} WHERE d.user_id = ? ORDER BY d.entry_date DESC, d.entry_time IS NULL, d.entry_time DESC, d.created_at DESC`, [actor.id]);
  return { entries: rows.map((row) => present(row, actor)), scope };
}

export async function saveDiary(actor, input) {
  const { date, time } = diaryWhen(input);
  const title = clean(input.title, 'title', 180);
  const content = clean(input.content, 'diary', 8000);
  const now = new Date();
  const id = crypto.randomUUID();
  await teamQuery(
    `INSERT INTO tm_diary (id, user_id, entry_date, entry_time, title, content, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, actor.id, date, time, title, content, now, now]
  );
  const rows = await teamQuery(`${DIARY_SELECT} WHERE d.id = ?`, [id]);
  return { entry: present(rows[0], actor), saved: 'created' };
}

async function editableDiary(actor, id) {
  if (actor.role === 'super_admin') {
    return (await teamQuery('SELECT id, user_id, deleted_at FROM tm_diary WHERE id = ? LIMIT 1', [id]))[0];
  }
  if (actor.role === 'team_leader' && actor.teamId) {
    return (await teamQuery(
      `SELECT d.id, d.user_id, d.deleted_at FROM tm_diary d
       JOIN tm_users u ON u.id = d.user_id
       WHERE d.id = ? AND (d.user_id = ? OR u.team_id = ?)
       LIMIT 1`,
      [id, actor.id, actor.teamId]
    ))[0];
  }
  return (await teamQuery('SELECT id, user_id, deleted_at FROM tm_diary WHERE id = ? AND user_id = ? LIMIT 1', [id, actor.id]))[0];
}

export async function updateDiary(actor, id, input) {
  const current = await editableDiary(actor, id);
  if (!current) throw httpError('That diary entry was not found.', 404);
  if (input?.restore) {
    const now = new Date();
    await teamQuery('UPDATE tm_diary SET deleted_at = NULL, delete_reason = \'\', updated_at = ? WHERE id = ?', [now, id]);
    const restored = await teamQuery(`${DIARY_SELECT} WHERE d.id = ?`, [id]);
    return { entry: present(restored[0], actor), saved: 'restored' };
  }
  if (current.deleted_at) throw httpError('Restore the note before editing it.');
  const { date, time } = diaryWhen(input);
  const title = clean(input.title, 'title', 180);
  const content = clean(input.content, 'diary', 8000);
  const now = new Date();
  await teamQuery(
    'UPDATE tm_diary SET entry_date = ?, entry_time = ?, title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [date, time, title, content, now, id, current.user_id]
  );
  const rows = await teamQuery(`${DIARY_SELECT} WHERE d.id = ?`, [id]);
  return { entry: present(rows[0], actor), saved: 'updated' };
}

export async function removeDiary(actor, id, input) {
  const reason = clean(input?.reason, 'reason', 500);
  const current = await editableDiary(actor, id);
  if (!current) throw httpError('That diary entry was not found.', 404);
  const now = new Date();
  await teamQuery('UPDATE tm_diary SET deleted_at = ?, delete_reason = ?, updated_at = ? WHERE id = ?', [now, reason, now, id]);
  return { id, deleted: true };
}
