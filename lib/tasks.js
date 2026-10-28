import 'server-only';
import crypto from 'node:crypto';
import { taskScriptKey, taskScriptUrl } from './defaults';
import { httpError } from './http';
import { deriveStatus, normalizeTaskInput } from './taskRules';

function scriptConfig() {
  const url = taskScriptUrl();
  const key = taskScriptKey();
  if (!url || !key) return null;
  return { url, key };
}

async function callScript(action, payload) {
  const config = scriptConfig();
  if (!config) {
    throw httpError(
      'The task web app URL is missing.',
      502
    );
  }

  let endpoint;
  try {
    endpoint = new URL(config.url);
  } catch {
    throw httpError('TASK_SCRIPT_URL is not a valid Apps Script web app URL.', 502);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'follow',
    cache: 'no-store',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key: config.key, action, ...payload }),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw httpError(
      'The Tasks web app did not return data. Deploy it as Execute as: Me, and Who has access: Anyone.',
      502
    );
  }

  if (data.error === 'unauthorized' || data.ok === false) {
    const raw = String(data.error || '');
    const message =
      raw === 'unauthorized'
        ? 'The Tasks web app rejected TASK_SCRIPT_KEY. Use the same value as the TASK_KEY script property.'
        : raw || 'The task could not be saved.';
    const status = raw === 'unauthorized' ? 502 : /not found/i.test(message) ? 404 : 400;
    throw httpError(message, status);
  }

  return data;
}

function presentStored(task, now = Date.now()) {
  return {
    taskId: String(task.taskId || ''),
    title: String(task.title || ''),
    description: String(task.description || ''),
    dueDate: String(task.dueDate || ''),
    dueTime: String(task.dueTime || ''),
    priority: String(task.priority || ''),
    status: deriveStatus(task, now),
    createdAt: String(task.createdAt || ''),
    updatedAt: String(task.updatedAt || ''),
    completedAt: String(task.completedAt || ''),
    reopenReason: String(task.reopenReason || ''),
    holdReason: String(task.holdReason || ''),
    rescheduleReason: String(task.rescheduleReason || ''),
    deleteReason: String(task.deleteReason || ''),
  };
}

export async function listTasks() {
  const data = await callScript('list');
  const now = Date.now();
  return (data.tasks || []).map((task) => presentStored(task, now));
}

export async function createTask(input) {
  const checked = normalizeTaskInput(input);
  if (!checked.ok) throw httpError(checked.error);

  const now = new Date().toISOString();
  const task = {
    taskId: crypto.randomUUID(),
    ...checked.value,
    status: deriveStatus({ ...checked.value, completedAt: '' }),
    createdAt: now,
    updatedAt: now,
    completedAt: '',
    reopenReason: '',
    holdReason: '',
    rescheduleReason: '',
    deleteReason: '',
  };
  const data = await callScript('create', { task });
  return presentStored(data.task || task);
}

export async function updateTask(taskId, input) {
  const checked = normalizeTaskInput(input);
  if (!checked.ok) throw httpError(checked.error);
  const task = {
    ...checked.value,
    updatedAt: new Date().toISOString(),
  };
  if (Object.prototype.hasOwnProperty.call(input, 'rescheduleReason')) {
    const text = String(input.rescheduleReason || '').trim();
    if (!text) throw httpError('Enter why this task is being rescheduled.');
    if (text.length > 500) throw httpError('The reason must be 500 characters or less.');
    task.rescheduleReason = text;
  }
  const data = await callScript('update', { taskId, task });
  return presentStored(data.task);
}

export async function completeTask(taskId) {
  const now = new Date().toISOString();
  const data = await callScript('complete', { taskId, completedAt: now, updatedAt: now });
  return presentStored(data.task);
}

export async function reopenTask(taskId, reason) {
  const text = String(reason || '').trim();
  if (!text) throw httpError('Enter why this task is being reopened.');
  if (text.length > 500) throw httpError('The reopen reason must be 500 characters or less.');
  const data = await callScript('reopen', { taskId, reason: text, updatedAt: new Date().toISOString() });
  return presentStored(data.task);
}

export async function holdTask(taskId, reason) {
  const text = String(reason || '').trim();
  if (!text) throw httpError('Enter why this task is being put on hold.');
  if (text.length > 500) throw httpError('The reason must be 500 characters or less.');
  const data = await callScript('hold', { taskId, reason: text, updatedAt: new Date().toISOString() });
  return presentStored(data.task);
}

export async function releaseTask(taskId) {
  const data = await callScript('release', { taskId, updatedAt: new Date().toISOString() });
  return presentStored(data.task);
}

export async function deleteTask(taskId, reason) {
  const text = String(reason || '').trim();
  if (!text) throw httpError('Enter why this task is being deleted.');
  if (text.length > 500) throw httpError('The reason must be 500 characters or less.');
  const data = await callScript('delete', { taskId, reason: text, updatedAt: new Date().toISOString() });
  return presentStored(data.task);
}
