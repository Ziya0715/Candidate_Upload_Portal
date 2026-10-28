'use client';

import { readJson } from '@/lib/readJson';

export async function teamFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      'x-team-request': '1',
      ...(options.headers || {}),
    },
  });
  return readJson(response);
}

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  team_leader: 'Team Leader',
  team_member: 'Team Member',
};

export const STATUS_LABELS = { todo: 'To Do', pending: 'Pending', hold: 'Hold', deleted: 'Deleted', completed: 'Completed' };
export const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
