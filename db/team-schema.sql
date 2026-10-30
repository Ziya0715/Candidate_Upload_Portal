CREATE TABLE IF NOT EXISTS tm_teams (
  id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  leader_id CHAR(36) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tm_teams_name (name)
);

CREATE TABLE IF NOT EXISTS tm_users (
  id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'team_leader', 'team_member') NOT NULL,
  team_id CHAR(36) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  can_create_tasks TINYINT(1) NOT NULL DEFAULT 0,
  can_manage_members TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tm_users_email (email),
  KEY idx_tm_users_team (team_id),
  KEY idx_tm_users_role (role),
  CONSTRAINT fk_tm_users_team FOREIGN KEY (team_id) REFERENCES tm_teams (id)
);

CREATE TABLE IF NOT EXISTS tm_tasks (
  id CHAR(36) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  team_id CHAR(36) NOT NULL,
  created_by CHAR(36) NOT NULL,
  assigned_to CHAR(36) NOT NULL,
  priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
  status ENUM('todo', 'pending', 'hold', 'deleted', 'completed') NOT NULL DEFAULT 'todo',
  hold_reason VARCHAR(500) NOT NULL DEFAULT '',
  delete_reason VARCHAR(500) NOT NULL DEFAULT '',
  reopen_reason VARCHAR(500) NOT NULL DEFAULT '',
  start_date DATE NULL,
  due_date DATE NULL,
  due_time CHAR(5) NULL,
  completed_at DATETIME(3) NULL,
  completed_by CHAR(36) NULL,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_tm_tasks_team (team_id, status),
  KEY idx_tm_tasks_assignee (assigned_to, status),
  KEY idx_tm_tasks_due (due_date),
  CONSTRAINT fk_tm_tasks_team FOREIGN KEY (team_id) REFERENCES tm_teams (id),
  CONSTRAINT fk_tm_tasks_creator FOREIGN KEY (created_by) REFERENCES tm_users (id),
  CONSTRAINT fk_tm_tasks_assignee FOREIGN KEY (assigned_to) REFERENCES tm_users (id),
  CONSTRAINT fk_tm_tasks_completer FOREIGN KEY (completed_by) REFERENCES tm_users (id)
);

CREATE TABLE IF NOT EXISTS tm_task_comments (
  id CHAR(36) NOT NULL,
  task_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  comment VARCHAR(2000) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_tm_comments_task (task_id, created_at),
  CONSTRAINT fk_tm_comments_task FOREIGN KEY (task_id) REFERENCES tm_tasks (id),
  CONSTRAINT fk_tm_comments_user FOREIGN KEY (user_id) REFERENCES tm_users (id)
);

CREATE TABLE IF NOT EXISTS tm_activity_logs (
  id CHAR(36) NOT NULL,
  task_id CHAR(36) NULL,
  user_id CHAR(36) NULL,
  action VARCHAR(40) NOT NULL,
  old_value VARCHAR(500) NOT NULL DEFAULT '',
  new_value VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_tm_activity_task (task_id, created_at),
  CONSTRAINT fk_tm_activity_task FOREIGN KEY (task_id) REFERENCES tm_tasks (id),
  CONSTRAINT fk_tm_activity_user FOREIGN KEY (user_id) REFERENCES tm_users (id)
);

CREATE TABLE IF NOT EXISTS tm_diary (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  entry_date DATE NOT NULL,
  entry_time CHAR(5) NULL,
  title VARCHAR(180) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  deleted_at DATETIME(3) NULL,
  delete_reason VARCHAR(500) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY idx_tm_diary_user (user_id, entry_date),
  CONSTRAINT fk_tm_diary_user FOREIGN KEY (user_id) REFERENCES tm_users (id)
);

CREATE TABLE IF NOT EXISTS tm_login_attempts (
  id CHAR(36) NOT NULL,
  email VARCHAR(190) NOT NULL,
  attempted_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_tm_login_email (email, attempted_at)
);
