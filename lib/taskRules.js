const KOLKATA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export const TASK_PRIORITIES = ['Low', 'Medium', 'High'];
export const TASK_STATUSES = ['To Do', 'Hold', 'Pending', 'Complete', 'Deleted'];

export function deadlineFor(dueDate, dueTime) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dueDate || '').trim());
  if (!date) return null;

  const year = Number(date[1]);
  const month = Number(date[2]);
  const day = Number(date[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let hour = 23;
  let minute = 59;
  let second = 59;
  let ms = 999;
  const timeText = String(dueTime || '').trim();
  if (timeText) {
    const time = /^(\d{2}):(\d{2})$/.exec(timeText);
    if (!time) return null;
    hour = Number(time[1]);
    minute = Number(time[2]);
    if (hour > 23 || minute > 59) return null;
    second = 0;
    ms = 0;
  }

  const wall = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const parsed = new Date(wall);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return new Date(wall - KOLKATA_OFFSET_MS);
}

export function deriveStatus(task, now = Date.now()) {
  if (String(task?.status || '') === 'Deleted') return 'Deleted';
  if (String(task?.completedAt || '').trim()) return 'Complete';
  if (String(task?.status || '') === 'Hold') return 'Hold';
  const deadline = deadlineFor(task?.dueDate, task?.dueTime);
  if (!deadline) return 'To Do';
  if (now > deadline.getTime()) return 'Pending';
  return 'To Do';
}

export function overdueLabel(dueDate, dueTime, now = Date.now()) {
  const deadline = deadlineFor(dueDate, dueTime);
  if (!deadline) return '';
  const diff = now - deadline.getTime();
  if (diff <= 0) return '';

  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) {
    const count = Math.max(1, minutes);
    return `Overdue by ${count} ${count === 1 ? 'minute' : 'minutes'}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Overdue by ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }

  const days = Math.floor(hours / 24);
  return `Overdue by ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function todayInKolkata(now = Date.now()) {
  const shifted = new Date(now + KOLKATA_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

export function nowInKolkata(now = Date.now()) {
  const shifted = new Date(now + KOLKATA_OFFSET_MS);
  return `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
}

export function formatDueTime(dueTime) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(dueTime || '').trim());
  if (!match) return 'End of day';
  let hour = Number(match[1]);
  const minute = match[2];
  if (hour > 23) return dueTime;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

export function formatDueDate(dueDate) {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dueDate || ''));
  if (!date) return dueDate || '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]))));
}

function normalizeTime(value) {
  const text = String(value || '').trim();
  if (!text) return { ok: true, dueTime: '' };
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (!match) return { ok: false, error: 'Enter a valid due time.' };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return { ok: false, error: 'Enter a valid due time.' };
  return { ok: true, dueTime: `${match[1]}:${match[2]}` };
}

export function normalizeTaskInput(input) {
  const title = String(input?.title || '').trim();
  const description = String(input?.description || '').trim();
  const dueDate = String(input?.dueDate || '').trim();
  const priority = String(input?.priority || '').trim();
  const time = normalizeTime(input?.dueTime);

  if (!title) return { ok: false, error: 'Enter a task title.' };
  if (title.length > 180) return { ok: false, error: 'The title must be 180 characters or less.' };
  if (description.length > 2000) {
    return { ok: false, error: 'The description must be 2000 characters or less.' };
  }
  if (!deadlineFor(dueDate, time.ok ? time.dueTime : '00:00') && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return { ok: false, error: 'Enter a due date.' };
  }
  if (!time.ok) return time;
  if (!deadlineFor(dueDate, time.dueTime)) return { ok: false, error: 'Enter a valid due date.' };
  if (!TASK_PRIORITIES.includes(priority)) return { ok: false, error: 'Choose a priority.' };

  return {
    ok: true,
    value: {
      title,
      description,
      dueDate,
      dueTime: time.dueTime,
      priority,
    },
  };
}

export function presentTask(task, now = Date.now()) {
  const status = deriveStatus(task, now);
  return {
    ...task,
    status,
    overdueLabel: status === 'Pending' || status === 'Hold' || status === 'Deleted' ? overdueLabel(task.dueDate, task.dueTime, now) : '',
  };
}
