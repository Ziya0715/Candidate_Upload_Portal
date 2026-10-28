import 'server-only';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { httpError } from '../http';
import { deadlineFor } from '../taskRules';
import { teamQuery, teamTransaction } from './db';

const ROLES = new Set(['super_admin', 'team_leader', 'team_member']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const STATUSES = new Set(['todo', 'pending', 'hold', 'deleted', 'completed']);

export function todayKolkata() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function clean(value, label, max) {
  const text = String(value || '').trim();
  if (!text) throw httpError(`Enter a ${label}.`);
  if (text.length > max) throw httpError(`The ${label} must be ${max} characters or less.`);
  return text;
}

function dateOrNull(value, label) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw httpError(`Enter a valid ${label}.`);
  return text;
}

function dateFromToday(value, label) {
  const date = dateOrNull(value, label);
  if (date && date < todayKolkata()) throw httpError(`Choose a ${label} of today or later.`);
  return date;
}

function clockValue(value) {
  if (!value) return '';
  const match = /^(\d{2}):(\d{2})/.exec(String(value).trim());
  return match ? `${match[1]}:${match[2]}` : '';
}

function dueTimeOrEmpty(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const time = clockValue(text);
  if (!time) throw httpError('Enter a valid due time.');
  return time;
}

function deadlineMissed(dueDate, dueTime, now = Date.now()) {
  const date = String(dueDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const deadline = deadlineFor(date, clockValue(dueTime));
  return Boolean(deadline && now > deadline.getTime());
}

function assertOpenDeadline(dueDate, dueTime) {
  if (dueDate && !dueTime) throw httpError('Enter a due time.');
  if (dueTime && !dueDate) throw httpError('Enter a due date.');
  if (dueDate && dueTime && deadlineMissed(dueDate, dueTime)) throw httpError('Choose a due time that has not passed.');
}

const MISSED_DEADLINE = `(
  t.due_date IS NOT NULL AND (
    (NULLIF(t.due_time, '') IS NOT NULL AND TIMESTAMP(t.due_date, t.due_time) < NOW())
    OR (NULLIF(t.due_time, '') IS NULL AND t.due_date < CURDATE())
  )
)`;

function scope(actor, alias = 't', options = {}) {
  const visible = options.includeArchived
    ? `(${alias}.deleted_at IS NULL OR ${alias}.status = 'deleted')`
    : `${alias}.deleted_at IS NULL`;
  if (actor.role === 'super_admin') return { sql: visible, params: [] };
  if (actor.role === 'team_leader' && actor.teamId) {
    return {
      sql: `${visible} AND (${alias}.team_id = ? OR ${alias}.assigned_to = ? OR ${alias}.created_by = ? OR ${alias}.assigned_to IN (SELECT id FROM tm_users WHERE team_id = ?))`,
      params: [actor.teamId, actor.id, actor.id, actor.teamId],
    };
  }
  return {
    sql: `${visible} AND (${alias}.assigned_to = ? OR ${alias}.created_by = ?)`,
    params: [actor.id, actor.id],
  };
}

function accessFor(actor, task) {
  if (actor.role === 'super_admin') return 'manage';
  if (actor.role === 'team_leader' && actor.teamId && task.team_id === actor.teamId) return 'manage';
  if (task.assigned_to === actor.id || task.created_by === actor.id) return 'progress';
  return 'none';
}

async function log(connection, { taskId = null, userId = null, action, oldValue = '', newValue = '' }) {
  await connection.query(
    `INSERT INTO tm_activity_logs (id, task_id, user_id, action, old_value, new_value, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [crypto.randomUUID(), taskId, userId, action, String(oldValue).slice(0, 500), String(newValue).slice(0, 500), new Date()]
  );
}

export async function markOverdue() {
  const missed = `(
    due_date IS NOT NULL AND (
      (NULLIF(due_time, '') IS NOT NULL AND TIMESTAMP(due_date, due_time) < NOW())
      OR (NULLIF(due_time, '') IS NULL AND due_date < CURDATE())
    )
  )`;
  const canMove = `(reopen_reason = '' OR (due_date >= CURDATE() AND NULLIF(due_time, '') IS NOT NULL))`;
  const due = await teamQuery(
    `SELECT id, assigned_to FROM tm_tasks
     WHERE deleted_at IS NULL AND completed_at IS NULL AND status = 'todo' AND ${canMove} AND ${missed}`
  );
  if (!due.length) return 0;
  await teamTransaction(async (connection) => {
    await connection.query(
      `UPDATE tm_tasks SET status = 'pending', updated_at = ?
       WHERE deleted_at IS NULL AND completed_at IS NULL AND status = 'todo' AND ${canMove} AND ${missed}`,
      [new Date()]
    );
    for (const row of due) {
      await log(connection, {
        taskId: row.id,
        userId: null,
        action: 'status',
        oldValue: 'todo',
        newValue: 'pending',
      });
    }
  });
  return due.length;
}

const TASK_SELECT = `SELECT t.*, tm.name AS team_name, c.name AS creator_name, a.name AS assignee_name, cb.name AS completer_name
  FROM tm_tasks t
  JOIN tm_teams tm ON tm.id = t.team_id
  JOIN tm_users c ON c.id = t.created_by
  JOIN tm_users a ON a.id = t.assigned_to
  LEFT JOIN tm_users cb ON cb.id = t.completed_by`;

function presentTask(row, actor) {
  const dueTime = clockValue(row.due_time);
  const overdue = !['completed', 'deleted', 'hold'].includes(row.status) && deadlineMissed(row.due_date, dueTime);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    teamId: row.team_id,
    teamName: row.team_name,
    createdBy: row.created_by,
    creatorName: row.creator_name,
    assignedTo: row.assigned_to,
    assigneeName: row.assignee_name,
    priority: row.priority,
    status: row.status,
    startDate: row.start_date,
    dueDate: row.due_date,
    dueTime,
    completedAt: row.completed_at,
    completedByName: row.completer_name || '',
    holdReason: row.hold_reason || '',
    deleteReason: row.delete_reason || '',
    reopenReason: row.reopen_reason || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    overdue: Boolean(overdue),
    access: actor ? accessFor(actor, row) : 'view',
  };
}

export async function listTeams(actor) {
  if (actor.role === 'super_admin') {
    return teamQuery(
      `SELECT t.id, t.name, t.description, t.leader_id, t.is_active, u.name AS leader_name,
              (SELECT COUNT(*) FROM tm_users m WHERE m.team_id = t.id AND m.is_active = 1) AS member_count
       FROM tm_teams t
       LEFT JOIN tm_users u ON u.id = t.leader_id
       ORDER BY t.name`
    );
  }
  if (!actor.teamId) return [];
  return teamQuery(
    `SELECT t.id, t.name, t.description, t.leader_id, t.is_active, u.name AS leader_name,
            (SELECT COUNT(*) FROM tm_users m WHERE m.team_id = t.id AND m.is_active = 1) AS member_count
     FROM tm_teams t
     LEFT JOIN tm_users u ON u.id = t.leader_id
     WHERE t.id = ?`,
    [actor.teamId]
  );
}

async function activeTeam(teamId) {
  const rows = await teamQuery('SELECT id, name, is_active FROM tm_teams WHERE id = ? LIMIT 1', [teamId]);
  return rows[0] || null;
}

export async function saveTeam(actor, input, teamId) {
  if (actor.role !== 'super_admin') throw httpError('You cannot manage teams.', 403);
  const name = clean(input.name, 'team name', 120);
  const description = String(input.description || '').trim().slice(0, 500);
  const isActive = input.isActive === false || input.isActive === 0 ? 0 : 1;
  const dupes = await teamQuery('SELECT id FROM tm_teams WHERE name = ? AND id <> ? LIMIT 1', [name, teamId || '']);
  if (dupes[0]) throw httpError('A team with that name already exists.');
  const now = new Date();
  if (!teamId) {
    const id = crypto.randomUUID();
    await teamQuery(
      'INSERT INTO tm_teams (id, name, description, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      [id, name, description, isActive, now, now]
    );
    return { id };
  }
  const existing = await activeTeam(teamId);
  if (!existing) throw httpError('That team was not found.', 404);
  await teamQuery('UPDATE tm_teams SET name = ?, description = ?, is_active = ?, updated_at = ? WHERE id = ?', [
    name,
    description,
    isActive,
    now,
    teamId,
  ]);
  return { id: teamId };
}

export async function setTeamLeader(actor, teamId, leaderId) {
  if (actor.role !== 'super_admin') throw httpError('You cannot assign team leaders.', 403);
  const team = await activeTeam(teamId);
  if (!team) throw httpError('That team was not found.', 404);
  await teamTransaction(async (connection) => {
    const [current] = await connection.query('SELECT leader_id FROM tm_teams WHERE id = ? LIMIT 1', [teamId]);
    const previousId = current[0]?.leader_id || null;
    if (!leaderId) {
      await connection.query('UPDATE tm_teams SET leader_id = NULL, updated_at = ? WHERE id = ?', [new Date(), teamId]);
    } else {
      const [users] = await connection.query(
        'SELECT id, role, is_active FROM tm_users WHERE id = ? LIMIT 1',
        [leaderId]
      );
      const user = users[0];
      if (!user || !user.is_active) throw httpError('Choose an active user.', 404);
      if (user.role === 'super_admin') throw httpError('A Super Admin is not assigned as a team leader.');
      await connection.query(
        `UPDATE tm_users SET role = 'team_leader', team_id = ?, updated_at = ? WHERE id = ?`,
        [teamId, new Date(), leaderId]
      );
      await connection.query('UPDATE tm_teams SET leader_id = ?, updated_at = ? WHERE id = ?', [leaderId, new Date(), teamId]);
    }
    if (previousId && previousId !== leaderId) {
      const [still] = await connection.query('SELECT id FROM tm_teams WHERE leader_id = ? LIMIT 1', [previousId]);
      if (!still[0]) {
        await connection.query(
          `UPDATE tm_users SET role = 'team_member', updated_at = ? WHERE id = ? AND role = 'team_leader'`,
          [new Date(), previousId]
        );
      }
    }
  });
  return { id: teamId };
}

export async function listUsers(actor, filters = {}) {
  if (filters.assignable) {
    if (actor.role === 'team_member') {
      return teamQuery(
        `SELECT id, name, email, role, team_id, is_active, can_create_tasks, can_manage_members
         FROM tm_users WHERE id = ?`,
        [actor.id]
      );
    }
    const teamId = actor.role === 'super_admin' ? String(filters.teamId || '') : actor.teamId;
    if (!teamId) return [];
    if (actor.role !== 'super_admin' && teamId !== actor.teamId) throw httpError('You cannot view that team.', 403);
    return teamQuery(
      `SELECT id, name, email, role, team_id, is_active, can_create_tasks, can_manage_members
       FROM tm_users WHERE is_active = 1 AND team_id = ? ORDER BY name`,
      [teamId]
    );
  }
  if (actor.role !== 'super_admin') {
    throw httpError('You cannot view users.', 403);
  }
  const where = [];
  const params = [];
  if (actor.role === 'team_leader') {
    where.push('(team_id = ? OR team_id IS NULL)');
    params.push(actor.teamId || '');
  }
  if (filters.teamId) {
    where.push('team_id = ?');
    params.push(filters.teamId);
  }
  if (filters.q) {
    where.push('(name LIKE ? OR email LIKE ?)');
    const like = `%${String(filters.q).replace(/[\\%_]/g, '\\$&')}%`;
    params.push(like, like);
  }
  const sql = `SELECT id, name, email, role, team_id, is_active, can_create_tasks, can_manage_members, created_at, updated_at
    FROM tm_users ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name`;
  return teamQuery(sql, params);
}

export async function saveUser(actor, input, userId) {
  const now = new Date();
  if (!userId) {
    if (actor.role !== 'super_admin') throw httpError('You cannot create users.', 403);
    const name = clean(input.name, 'name', 120);
    const email = clean(input.email, 'email', 190).toLowerCase();
    const password = String(input.password || '');
    if (password.length < 8 || password.length > 200) throw httpError('Use a password of at least 8 characters.');
    const role = ROLES.has(input.role) ? input.role : 'team_member';
    if (role === 'super_admin' && actor.role !== 'super_admin') throw httpError('You cannot grant Super Admin.', 403);
    const teamId = input.teamId || null;
    if (teamId && !(await activeTeam(teamId))) throw httpError('Choose a team.');
    const existing = await teamQuery('SELECT id FROM tm_users WHERE email = ? LIMIT 1', [email]);
    if (existing[0]) throw httpError('That email is already used.');
    const hash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    await teamQuery(
      `INSERT INTO tm_users (id, name, email, password_hash, role, team_id, is_active, can_create_tasks, can_manage_members, created_at, updated_at)
       VALUES (?,?,?,?,?,?,1,?,?,?,?)`,
      [id, name, email, hash, role, teamId, input.canCreateTasks ? 1 : 0, input.canManageMembers ? 1 : 0, now, now]
    );
    return { id };
  }

  const rows = await teamQuery('SELECT * FROM tm_users WHERE id = ? LIMIT 1', [userId]);
  const current = rows[0];
  if (!current) throw httpError('That user was not found.', 404);
  const leaderEditingMember = actor.role === 'team_leader' && actor.canManageMembers && actor.teamId
    && (current.team_id === actor.teamId || !current.team_id);
  if (actor.role !== 'super_admin' && !leaderEditingMember) throw httpError('You cannot edit that user.', 403);
  if (actor.id === userId && input.role && input.role !== current.role) throw httpError('You cannot change your own role.');
  if (actor.id === userId && input.isActive === false) throw httpError('You cannot deactivate yourself.');

  if (actor.role !== 'super_admin') {
    const teamId = input.teamId === undefined ? current.team_id : input.teamId || null;
    if (teamId && teamId !== actor.teamId) throw httpError('You can only manage your own team.', 403);
    await teamQuery('UPDATE tm_users SET team_id = ?, updated_at = ? WHERE id = ?', [teamId, now, userId]);
    return { id: userId };
  }

  const name = clean(input.name ?? current.name, 'name', 120);
  const email = clean(input.email ?? current.email, 'email', 190).toLowerCase();
  const role = ROLES.has(input.role) ? input.role : current.role;
  if (current.role === 'super_admin' && role !== 'super_admin') {
    const count = await teamQuery(`SELECT COUNT(*) AS total FROM tm_users WHERE role = 'super_admin' AND is_active = 1`);
    if (Number(count[0]?.total || 0) < 2) throw httpError('Keep at least one active Super Admin.');
  }
  const teamId = input.teamId === undefined ? current.team_id : input.teamId || null;
  if (teamId && !(await activeTeam(teamId))) throw httpError('Choose a team.');
  const dupe = await teamQuery('SELECT id FROM tm_users WHERE email = ? AND id <> ? LIMIT 1', [email, userId]);
  if (dupe[0]) throw httpError('That email is already used.');
  const isActive = input.isActive === false || input.isActive === 0 ? 0 : 1;
  await teamQuery(
    `UPDATE tm_users SET name = ?, email = ?, role = ?, team_id = ?, is_active = ?, can_create_tasks = ?, can_manage_members = ?, updated_at = ?
     WHERE id = ?`,
    [name, email, role, teamId, isActive, input.canCreateTasks ? 1 : 0, input.canManageMembers ? 1 : 0, now, userId]
  );
  if (input.password) {
    const password = String(input.password);
    if (password.length < 8 || password.length > 200) throw httpError('Use a password of at least 8 characters.');
    const hash = await bcrypt.hash(password, 12);
    await teamQuery('UPDATE tm_users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, now, userId]);
  }
  return { id: userId };
}

export async function changeOwnPassword(actor, currentPassword, nextPassword) {
  const next = String(nextPassword || '');
  if (next.length < 8 || next.length > 200) throw httpError('Use a password of at least 8 characters.');
  const rows = await teamQuery('SELECT password_hash FROM tm_users WHERE id = ? LIMIT 1', [actor.id]);
  const matches = rows[0] ? await bcrypt.compare(String(currentPassword || ''), rows[0].password_hash) : false;
  if (!matches) throw httpError('The current password is incorrect.', 401);
  const hash = await bcrypt.hash(next, 12);
  await teamQuery('UPDATE tm_users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, new Date(), actor.id]);
  return { ok: true };
}

async function assigneeOnTeam(teamId, userId) {
  const rows = await teamQuery(
    'SELECT id FROM tm_users WHERE id = ? AND team_id = ? AND is_active = 1 LIMIT 1',
    [userId, teamId]
  );
  return Boolean(rows[0]);
}

export async function listTasks(actor, filters = {}) {
  await markOverdue();
  const gate = scope(actor, 't', { includeArchived: true });
  const where = [gate.sql];
  const params = [...gate.params];
  if (filters.mine === '1' && actor.role !== 'super_admin' && actor.role !== 'team_leader') {
    where.push('(t.assigned_to = ? OR t.created_by = ?)');
    params.push(actor.id, actor.id);
  }
  if (filters.status === 'hold_delete') {
    where.push(`t.status IN ('hold', 'deleted')`);
  } else if (filters.status && STATUSES.has(filters.status)) {
    where.push('t.status = ?');
    params.push(filters.status);
  }
  if (filters.priority && PRIORITIES.has(filters.priority)) {
    where.push('t.priority = ?');
    params.push(filters.priority);
  }
  if (filters.teamId) {
    if (actor.role !== 'super_admin' && filters.teamId !== actor.teamId) throw httpError('You cannot view that team.', 403);
    where.push('t.team_id = ?');
    params.push(filters.teamId);
  }
  if (filters.assigneeId) {
    if (actor.role === 'team_member' && filters.assigneeId !== actor.id) {
      throw httpError('You cannot view another person\'s tasks.', 403);
    }
    if (actor.role === 'team_leader') {
      const allowed = await teamQuery('SELECT id FROM tm_users WHERE id = ? AND team_id = ? LIMIT 1', [filters.assigneeId, actor.teamId]);
      if (!allowed[0] && filters.assigneeId !== actor.id) throw httpError('You cannot view another team\'s tasks.', 403);
    }
    where.push('t.assigned_to = ?');
    params.push(filters.assigneeId);
  }
  if (filters.due === 'overdue') {
    where.push(`t.status <> 'completed' AND ${MISSED_DEADLINE}`);
  }
  if (filters.q) {
    where.push('(t.title LIKE ? OR t.id = ?)');
    params.push(`%${String(filters.q).replace(/[\\%_]/g, '\\$&')}%`, String(filters.q).trim());
  }
  const sort = filters.sort === 'due'
    ? 't.due_date IS NULL, t.due_date ASC, t.due_time ASC'
    : filters.sort === 'priority'
      ? `FIELD(t.priority, 'urgent', 'high', 'medium', 'low')`
      : 't.created_at DESC';
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 80));
  const countRows = await teamQuery(`SELECT COUNT(*) AS total FROM tm_tasks t WHERE ${where.join(' AND ')}`, params);
  const rows = await teamQuery(
    `${TASK_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { tasks: rows.map((row) => presentTask(row, actor)), total: Number(countRows[0]?.total || 0), page, pageSize };
}

export async function getTask(actor, id) {
  await markOverdue();
  const gate = scope(actor, 't', { includeArchived: true });
  const rows = await teamQuery(`${TASK_SELECT} WHERE t.id = ? AND ${gate.sql} LIMIT 1`, [id, ...gate.params]);
  if (!rows[0]) throw httpError('That task was not found.', 404);
  const comments = await teamQuery(
    `SELECT c.id, c.comment, c.created_at, u.name AS user_name
     FROM tm_task_comments c JOIN tm_users u ON u.id = c.user_id
     WHERE c.task_id = ? ORDER BY c.created_at`,
    [id]
  );
  const activity = await teamQuery(
    `SELECT l.id, l.action, l.old_value, l.new_value, l.created_at, u.name AS user_name
     FROM tm_activity_logs l LEFT JOIN tm_users u ON u.id = l.user_id
     WHERE l.task_id = ? ORDER BY l.created_at DESC LIMIT 50`,
    [id]
  );
  return { task: presentTask(rows[0], actor), comments, activity };
}

export async function createTask(actor, input) {
  const title = clean(input.title, 'title', 180);
  const description = String(input.description || '').trim().slice(0, 5000);
  const teamId = String(input.teamId || '');
  const priority = PRIORITIES.has(input.priority) ? input.priority : 'medium';
  const startDate = dateFromToday(input.startDate, 'start date');
  const dueDate = dateFromToday(input.dueDate, 'due date');
  const dueTime = dueTimeOrEmpty(input.dueTime);
  if (startDate && dueDate && dueDate < startDate) throw httpError('The due date cannot be before the start date.');
  assertOpenDeadline(dueDate, dueTime);
  const team = await activeTeam(teamId);
  if (!team || !team.is_active) throw httpError('Choose an active team.');
  let assignedTo = String(input.assignedTo || '');
  if (actor.role === 'team_member') {
    if (!actor.canCreateTasks) throw httpError('You cannot create tasks.', 403);
    if (teamId !== actor.teamId) throw httpError('You can only create tasks for your team.', 403);
    assignedTo = actor.id;
  } else if (actor.role === 'team_leader') {
    if (teamId !== actor.teamId) throw httpError('You can only create tasks for your team.', 403);
  } else if (actor.role !== 'super_admin') {
    throw httpError('You cannot create tasks.', 403);
  }
  if (!(await assigneeOnTeam(teamId, assignedTo))) throw httpError('Assign an active member of that team.');
  const status = deadlineMissed(dueDate, dueTime) ? 'pending' : 'todo';
  const id = crypto.randomUUID();
  const now = new Date();
  const comment = String(input.comment || '').trim().slice(0, 2000);
  await teamTransaction(async (connection) => {
    await connection.query(
      `INSERT INTO tm_tasks (id, title, description, team_id, created_by, assigned_to, priority, status, start_date, due_date, due_time, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, title, description, teamId, actor.id, assignedTo, priority, status, startDate, dueDate, dueTime || null, now, now]
    );
    await log(connection, { taskId: id, userId: actor.id, action: 'created', newValue: title });
    if (comment) {
      await connection.query(
        'INSERT INTO tm_task_comments (id, task_id, user_id, comment, created_at) VALUES (?,?,?,?,?)',
        [crypto.randomUUID(), id, actor.id, comment, now]
      );
    }
  });
  return { id };
}

export async function updateTask(actor, id, input) {
  const current = await getTask(actor, id);
  if (current.task.access === 'none' || current.task.access === 'view') throw httpError('You cannot edit this task.', 403);
  const manage = current.task.access === 'manage';
  const reopening = current.task.status === 'completed' && (input.status === 'todo' || input.status === 'pending');
  const rescheduling = input.reschedule === true;
  if (rescheduling && ['completed', 'deleted'].includes(current.task.status)) {
    throw httpError('This task cannot be rescheduled.');
  }
  const canEditText = manage || current.task.access === 'progress';
  const title = canEditText ? clean(input.title ?? current.task.title, 'title', 180) : current.task.title;
  const description = String(input.description ?? current.task.description).trim().slice(0, 5000);
  const priority = (canEditText || reopening) && PRIORITIES.has(input.priority) ? input.priority : current.task.priority;
  const canSetDates = rescheduling || reopening;
  const startDate = canSetDates && input.startDate !== undefined
    ? dateFromToday(input.startDate, 'start date')
    : current.task.startDate;
  const dueDate = canSetDates && input.dueDate !== undefined
    ? dateFromToday(input.dueDate, 'due date')
    : current.task.dueDate;
  const dueTime = canSetDates && input.dueTime !== undefined
    ? dueTimeOrEmpty(input.dueTime)
    : current.task.dueTime;
  if (startDate && dueDate && dueDate < startDate) throw httpError('The due date cannot be before the start date.');
  if (canSetDates) assertOpenDeadline(dueDate, dueTime);
  let teamId = current.task.teamId;
  let assignedTo = current.task.assignedTo;
  if (manage) {
    if (input.teamId && actor.role === 'super_admin') teamId = String(input.teamId);
    if (actor.role === 'team_leader') teamId = actor.teamId;
    if (input.assignedTo) assignedTo = String(input.assignedTo);
    if (!(await assigneeOnTeam(teamId, assignedTo))) throw httpError('Assign an active member of that team.');
  }
  let status = current.task.status;
  if (input.status && STATUSES.has(input.status)) {
    status = input.status;
  }
  const now = new Date();
  let completedAt = current.task.completedAt;
  let completedBy = null;
  const rows = await teamQuery('SELECT completed_by, deleted_at FROM tm_tasks WHERE id = ?', [id]);
  completedBy = rows[0]?.completed_by || null;
  let deletedAt = rows[0]?.deleted_at || null;
  let holdReason = status === 'hold' ? current.task.holdReason : '';
  let deleteReason = status === 'deleted' ? current.task.deleteReason : '';
  let reopenReason = current.task.reopenReason || '';
  let rescheduleReason = '';
  if (rescheduling) {
    rescheduleReason = clean(input.rescheduleReason, 'reason', 500);
    const sameStart = (current.task.startDate || '') === (startDate || '');
    const sameDue = (current.task.dueDate || '') === (dueDate || '') && (current.task.dueTime || '') === (dueTime || '');
    if (sameStart && sameDue) throw httpError('Choose a new date.');
    status = 'todo';
    holdReason = '';
    deleteReason = '';
    deletedAt = null;
  }
  if (current.task.status === 'pending' && status === 'todo' && !rescheduling) {
    throw httpError('Reschedule the task to move it back to To Do.');
  }
  if (status === 'completed' || status === 'hold' || status === 'deleted') reopenReason = '';
  else if ((current.task.dueDate || '') !== (dueDate || '') || (current.task.dueTime || '') !== (dueTime || '')) reopenReason = '';
  if (status === 'hold' && current.task.status !== 'hold') {
    holdReason = clean(input.holdReason, 'reason', 500);
  }
  if (status === 'deleted' && current.task.status !== 'deleted') {
    deleteReason = clean(input.deleteReason, 'reason', 500);
    deletedAt = now;
  }
  if (status !== 'deleted') deletedAt = null;
  if (status === 'completed' && current.task.status !== 'completed') {
    completedAt = now;
    completedBy = actor.id;
  }
  if (status !== 'completed' && current.task.status === 'completed') {
    completedAt = null;
    completedBy = null;
    if (status === 'todo' || status === 'pending' || !input.status) {
      status = 'todo';
      reopenReason = clean(input.reopenReason, 'reason', 500);
    }
  }
  await teamTransaction(async (connection) => {
    await connection.query(
      `UPDATE tm_tasks SET title=?, description=?, team_id=?, assigned_to=?, priority=?, status=?, hold_reason=?, delete_reason=?, reopen_reason=?, start_date=?, due_date=?, due_time=?, completed_at=?, completed_by=?, deleted_at=?, updated_at=?
       WHERE id=?`,
      [title, description, teamId, assignedTo, priority, status, holdReason, deleteReason, reopenReason, startDate, dueDate, dueTime || null, completedAt, completedBy, deletedAt, now, id]
    );
    const changes = [
      ['edited', current.task.title, title, current.task.title !== title || current.task.description !== description],
      ['assigned', current.task.assignedTo, assignedTo, current.task.assignedTo !== assignedTo],
      ['priority', current.task.priority, priority, current.task.priority !== priority],
      ['due_date', current.task.dueDate || '', dueDate || '', (current.task.dueDate || '') !== (dueDate || '') && !rescheduling],
      ['rescheduled', `${current.task.dueDate || ''} ${current.task.dueTime || ''}`.trim(), `${dueDate || ''} ${dueTime || ''} (${rescheduleReason})`.trim(), rescheduling],
      ['status', current.task.status, status, current.task.status !== status && !['completed', 'hold', 'deleted'].includes(status) && !['completed', 'hold', 'deleted'].includes(current.task.status)],
      ['held', '', holdReason, current.task.status !== 'hold' && status === 'hold'],
      ['deleted', '', deleteReason, current.task.status !== 'deleted' && status === 'deleted'],
      ['completed', '', status, current.task.status !== 'completed' && status === 'completed'],
      ['reopened', 'completed', reopenReason, current.task.status === 'completed' && (status === 'todo' || status === 'pending')],
    ];
    for (const [action, oldValue, newValue, changed] of changes) {
      if (changed) await log(connection, { taskId: id, userId: actor.id, action, oldValue, newValue });
    }
  });
  return getTask(actor, id);
}

export async function removeTask(actor, id) {
  const current = await getTask(actor, id);
  if (current.task.access !== 'manage') throw httpError('You cannot delete this task.', 403);
  const now = new Date();
  await teamTransaction(async (connection) => {
    await connection.query(
      `UPDATE tm_tasks SET status = 'deleted', delete_reason = ?, deleted_at = ?, updated_at = ? WHERE id = ?`,
      ['Deleted', now, now, id]
    );
    await log(connection, { taskId: id, userId: actor.id, action: 'deleted', oldValue: current.task.title, newValue: 'Deleted' });
  });
  return { id };
}

export async function addComment(actor, id, comment) {
  const current = await getTask(actor, id);
  if (current.task.access === 'none') throw httpError('That task was not found.', 404);
  const text = clean(comment, 'comment', 2000);
  await teamQuery(
    'INSERT INTO tm_task_comments (id, task_id, user_id, comment, created_at) VALUES (?,?,?,?,?)',
    [crypto.randomUUID(), id, actor.id, text, new Date()]
  );
  return getTask(actor, id);
}

export async function dashboardFor(actor) {
  await markOverdue();
  const gate = scope(actor, 't');
  const counts = await teamQuery(
    `SELECT t.status, COUNT(*) AS total,
            SUM(t.status <> 'completed' AND ${MISSED_DEADLINE}) AS overdue
     FROM tm_tasks t WHERE ${gate.sql} GROUP BY t.status`,
    gate.params
  );
  const summary = { todo: 0, pending: 0, completed: 0, overdue: 0, total: 0 };
  for (const row of counts) {
    summary[row.status] = Number(row.total);
    summary.total += Number(row.total);
    summary.overdue += Number(row.overdue || 0);
  }
  let teams = [];
  let members = [];
  if (actor.role === 'super_admin') {
    teams = await teamQuery(
      `SELECT tm.id, tm.name,
              SUM(t.status = 'todo') AS todo,
              SUM(t.status = 'pending') AS pending,
              SUM(t.status = 'completed') AS completed,
              SUM(t.status <> 'completed' AND ${MISSED_DEADLINE}) AS overdue
       FROM tm_teams tm
       LEFT JOIN tm_tasks t ON t.team_id = tm.id AND t.deleted_at IS NULL
       GROUP BY tm.id ORDER BY tm.name`
    );
    const teamCount = await teamQuery('SELECT COUNT(*) AS total FROM tm_teams WHERE is_active = 1');
    const userCount = await teamQuery('SELECT COUNT(*) AS total FROM tm_users WHERE is_active = 1');
    summary.teams = Number(teamCount[0]?.total || 0);
    summary.users = Number(userCount[0]?.total || 0);
  }
  if (actor.role === 'team_leader' && actor.teamId) {
    const memberCount = await teamQuery('SELECT COUNT(*) AS total FROM tm_users WHERE team_id = ? AND is_active = 1', [actor.teamId]);
    summary.members = Number(memberCount[0]?.total || 0);
  }
  if (actor.role === 'super_admin' || actor.role === 'team_leader') {
    const memberWhere = actor.role === 'super_admin' ? '1=1' : 'u.team_id = ?';
    const memberParams = actor.role === 'super_admin' ? [] : [actor.teamId];
    members = await teamQuery(
      `SELECT u.id, u.name,
              SUM(t.id IS NOT NULL AND t.status = 'todo') AS todo,
              SUM(t.id IS NOT NULL AND t.status = 'pending') AS pending,
              SUM(t.id IS NOT NULL AND t.status = 'completed') AS completed,
              SUM(t.id IS NOT NULL AND t.status <> 'completed' AND ${MISSED_DEADLINE}) AS overdue
       FROM tm_users u
       LEFT JOIN tm_tasks t ON t.assigned_to = u.id AND t.deleted_at IS NULL
       WHERE ${memberWhere}
       GROUP BY u.id ORDER BY u.name`,
      memberParams
    );
  }
  const upcoming = await teamQuery(
    `${TASK_SELECT} WHERE ${gate.sql} AND t.status <> 'completed' AND t.due_date IS NOT NULL AND NOT ${MISSED_DEADLINE}
     ORDER BY t.due_date ASC, t.due_time ASC LIMIT 8`,
    gate.params
  );
  const recent = await teamQuery(
    `SELECT l.id, l.action, l.new_value, l.created_at, u.name AS user_name, task.title AS task_title
     FROM tm_activity_logs l
     LEFT JOIN tm_users u ON u.id = l.user_id
     LEFT JOIN tm_tasks task ON task.id = l.task_id
     WHERE l.task_id IS NULL OR l.task_id IN (SELECT id FROM tm_tasks t WHERE ${gate.sql})
     ORDER BY l.created_at DESC LIMIT 8`,
    gate.params
  );
  return {
    summary,
    teams,
    members,
    upcoming: upcoming.map((row) => presentTask(row, actor)),
    recent,
  };
}

export async function activityFor(actor) {
  const gate = scope(actor, 't');
  return teamQuery(
    `SELECT l.id, l.action, l.old_value, l.new_value, l.created_at, u.name AS user_name, task.title AS task_title
     FROM tm_activity_logs l
     LEFT JOIN tm_users u ON u.id = l.user_id
     LEFT JOIN tm_tasks task ON task.id = l.task_id
     WHERE l.task_id IS NULL OR EXISTS (SELECT 1 FROM tm_tasks t WHERE t.id = l.task_id AND ${gate.sql})
     ORDER BY l.created_at DESC LIMIT 100`,
    gate.params
  );
}
