import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const TEAMS = ['Video Editing Team', 'RA Team', 'Digital Marketing Team', 'Developer Team', 'Sales Team'];

function loadEnv() {
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

async function main() {
  loadEnv();
  const url = String(process.env.DATABASE_URL || '').trim();
  if (!url) {
    console.error('Set DATABASE_URL in .env.local first. The upload desk settings were not changed.');
    process.exit(1);
  }
  const connection = await mysql.createConnection({ uri: url, multipleStatements: true, timezone: '+05:30' });
  const schema = fs.readFileSync(path.join(process.cwd(), 'db', 'team-schema.sql'), 'utf8');
  for (const statement of schema.split(/;\s*\n/).map((part) => part.trim()).filter(Boolean)) {
    await connection.query(statement);
  }
  const [fk] = await connection.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tm_teams' AND CONSTRAINT_NAME = 'fk_tm_teams_leader'`
  );
  if (!fk.length) {
    await connection.query('ALTER TABLE tm_teams ADD CONSTRAINT fk_tm_teams_leader FOREIGN KEY (leader_id) REFERENCES tm_users (id)');
  }
  await connection.query(
    "ALTER TABLE tm_tasks MODIFY status ENUM('todo', 'pending', 'hold', 'deleted', 'completed') NOT NULL DEFAULT 'todo'"
  );
  const [reasonColumns] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tm_tasks' AND COLUMN_NAME IN ('hold_reason', 'delete_reason', 'reopen_reason')`
  );
  const names = new Set(reasonColumns.map((column) => column.COLUMN_NAME));
  if (!names.has('hold_reason')) {
    await connection.query("ALTER TABLE tm_tasks ADD COLUMN hold_reason VARCHAR(500) NOT NULL DEFAULT '' AFTER status");
  }
  if (!names.has('delete_reason')) {
    await connection.query("ALTER TABLE tm_tasks ADD COLUMN delete_reason VARCHAR(500) NOT NULL DEFAULT '' AFTER hold_reason");
  }
  if (!names.has('reopen_reason')) {
    await connection.query("ALTER TABLE tm_tasks ADD COLUMN reopen_reason VARCHAR(500) NOT NULL DEFAULT '' AFTER delete_reason");
  }
  const [timeColumn] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tm_tasks' AND COLUMN_NAME = 'due_time'`
  );
  if (!timeColumn.length) {
    await connection.query('ALTER TABLE tm_tasks ADD COLUMN due_time CHAR(5) NULL AFTER due_date');
  }
  const now = new Date();
  for (const name of TEAMS) {
    const [existing] = await connection.query('SELECT id FROM tm_teams WHERE name = ? LIMIT 1', [name]);
    if (!existing.length) {
      await connection.query(
        'INSERT INTO tm_teams (id, name, description, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?)',
        [crypto.randomUUID(), name, '', 1, now, now]
      );
    }
  }
  const email = String(process.env.STAFF_USERNAME || process.env.TEAM_SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.STAFF_PASSWORD || process.env.TEAM_SUPER_ADMIN_PASSWORD || '');
  if (email && password) {
    const [existing] = await connection.query('SELECT id FROM tm_users WHERE email = ? LIMIT 1', [email]);
    if (!existing.length) {
      const hash = await bcrypt.hash(password, 12);
      await connection.query(
        `INSERT INTO tm_users (id, name, email, password_hash, role, is_active, can_create_tasks, can_manage_members, created_at, updated_at)
         VALUES (?,?,?,?, 'super_admin', 1, 1, 1, ?, ?)`,
        [crypto.randomUUID(), 'Super Admin', email, hash, now, now]
      );
      console.log('Super Admin is ready.');
    } else {
      console.log('Super Admin already exists. Password was left unchanged.');
    }
  } else {
    console.log('Tables are ready. No Super Admin password was available to seed.');
  }
  await connection.end();
  console.log('Team tables are ready. Course tables were not changed.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
