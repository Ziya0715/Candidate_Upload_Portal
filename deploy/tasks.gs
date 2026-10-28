var HEADERS = ['taskId', 'title', 'description', 'dueDate', 'dueTime', 'priority', 'status', 'createdAt', 'updatedAt', 'completedAt', 'reopenReason', 'holdReason', 'rescheduleReason', 'deleteReason'];
var KOLKATA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
var PRIORITIES = { Low: true, Medium: true, High: true };

function doGet(e) {
  var key = e && e.parameter ? String(e.parameter.key || '') : '';
  if (!key) return json_({ ok: true, service: 'tasks' });
  return doPost({ postData: { contents: JSON.stringify({ key: key, action: 'list' }) } });
}

function doPost(e) {
  try {
    var body = {};
    try {
      body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (parseError) {
      return json_({ ok: false, error: 'The request was not valid JSON.' });
    }
    if (!authorized_(body)) return json_({ ok: false, error: 'unauthorized' });

    var action = String(body.action || '');
    if (action === 'list') return json_({ ok: true, tasks: listTasks_() });
    if (action === 'create') return json_({ ok: true, task: createTask_(body.task || {}) });
    if (action === 'update') return json_({ ok: true, task: updateTask_(body.taskId, body.task || {}) });
    if (action === 'complete') return json_({ ok: true, task: completeTask_(body.taskId, body.completedAt, body.updatedAt) });
    if (action === 'reopen') return json_({ ok: true, task: reopenTask_(body.taskId, body.updatedAt, body.reason) });
    if (action === 'hold') return json_({ ok: true, task: holdTask_(body.taskId, body.updatedAt, body.reason) });
    if (action === 'release') return json_({ ok: true, task: releaseTask_(body.taskId, body.updatedAt) });
    if (action === 'delete') return json_({ ok: true, task: deleteTask_(body.taskId, body.updatedAt, body.reason) });
    return json_({ ok: false, error: 'Unknown task action.' });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function syncTaskStatuses() {
  listTasks_();
}

function installStatusTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var index = 0; index < triggers.length; index += 1) {
    if (triggers[index].getHandlerFunction() === 'syncTaskStatuses') return;
  }
  ScriptApp.newTrigger('syncTaskStatuses').timeBased().everyHours(1).create();
}

function authorized_(body) {
  var expected = PropertiesService.getScriptProperties().getProperty('TASK_KEY');
  if (!expected) expected = '0e9357f6029622595caeaac1d5e958d563ca286f0167b04f';
  return String(body.key || '') === expected;
}

function spreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('Set the SPREADSHEET_ID script property or bind this script to a spreadsheet.');
}

function taskSheet_() {
  var spreadsheet = spreadsheet_();
  var sheet = spreadsheet.getSheetByName('Tasks');
  if (!sheet) sheet = spreadsheet.insertSheet('Tasks');

  var width = HEADERS.length;
  var first = sheet.getRange(1, 1, 1, width).getValues()[0];
  var same = true;
  for (var index = 0; index < width; index += 1) {
    if (String(first[index]) !== HEADERS[index]) same = false;
  }

  if (!same) {
    var used = sheet.getLastRow() > 1 || String(first[0] || '').trim();
    if (used && String(first[0] || '').trim() && String(first[0]) !== 'taskId') {
      throw new Error('The Tasks sheet already has different headers. Add a blank sheet named Tasks or fix row 1.');
    }
    sheet.getRange(1, 1, 1, width).setValues([HEADERS]);
    sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 1), width).setNumberFormat('@');
  }

  return sheet;
}

function listTasks_() {
  var sheet = taskSheet_();
  var values = sheet.getDataRange().getValues();
  var tasks = [];
  var dirty = [];
  var now = Date.now();

  for (var index = 1; index < values.length; index += 1) {
    var task = taskFromRow_(values[index], index + 1);
    if (!task) continue;
    var next = deriveStatus_(task, now);
    if (next !== task.status) {
      task.status = next;
      task.updatedAt = new Date(now).toISOString();
      dirty.push(task);
    }
    tasks.push(task);
  }

  if (dirty.length) {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      for (var dirtyIndex = 0; dirtyIndex < dirty.length; dirtyIndex += 1) {
        writeCells_(sheet, dirty[dirtyIndex]._row, { status: dirty[dirtyIndex].status, updatedAt: dirty[dirtyIndex].updatedAt });
      }
    } finally {
      lock.releaseLock();
    }
  }

  return tasks.map(publicTask_);
}

function createTask_(input) {
  var checked = validateTask_(input);
  var taskId = String(input.taskId || Utilities.getUuid());
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = taskSheet_();
    if (findRow_(sheet, taskId)) throw new Error('That task already exists.');
    var createdAt = String(input.createdAt || new Date().toISOString());
    var task = {
      taskId: taskId,
      title: checked.title,
      description: checked.description,
      dueDate: checked.dueDate,
      dueTime: checked.dueTime,
      priority: checked.priority,
      status: deriveStatus_(checked, Date.now()),
      createdAt: createdAt,
      updatedAt: String(input.updatedAt || createdAt),
      completedAt: '',
      reopenReason: '',
      holdReason: '',
      rescheduleReason: '',
      deleteReason: '',
    };
    sheet.appendRow(HEADERS.map(function (name) { return task[name]; }));
    return publicTask_(task);
  } finally {
    lock.releaseLock();
  }
}

function updateTask_(taskId, input) {
  var checked = validateTask_(input);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = taskSheet_();
    var row = findRow_(sheet, taskId);
    if (!row) throw new Error('That task was not found.');
    var current = taskFromRow_(sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0], row);
    var completedAt = current.completedAt;
    var status = String(current.status) === 'Deleted'
      ? 'Deleted'
      : (completedAt ? 'Complete' : (String(current.status) === 'Hold' ? 'Hold' : deriveStatus_(checked, Date.now())));
    var rescheduleReason = current.rescheduleReason || '';
    if (input.rescheduleReason !== undefined) {
      rescheduleReason = reasonText_(input.rescheduleReason, 'Enter why this task is being rescheduled.');
    }
    var task = {
      taskId: current.taskId,
      title: checked.title,
      description: checked.description,
      dueDate: checked.dueDate,
      dueTime: checked.dueTime,
      priority: checked.priority,
      status: status,
      createdAt: current.createdAt,
      updatedAt: String(input.updatedAt || new Date().toISOString()),
      completedAt: completedAt,
      reopenReason: current.reopenReason,
      holdReason: current.holdReason,
      rescheduleReason: rescheduleReason,
      deleteReason: current.deleteReason,
      _row: row,
    };
    writeRow_(sheet, task);
    return publicTask_(task);
  } finally {
    lock.releaseLock();
  }
}

function completeTask_(taskId, completedAt, updatedAt) {
  return withTask_(taskId, function (sheet, task) {
    if (!task.completedAt) {
      task.completedAt = String(completedAt || new Date().toISOString());
    }
    task.status = 'Complete';
    task.reopenReason = '';
    task.updatedAt = String(updatedAt || new Date().toISOString());
    writeRow_(sheet, task);
    return publicTask_(task);
  });
}

function reasonText_(value, emptyMessage) {
  var text = String(value || '').trim();
  if (!text) throw new Error(emptyMessage);
  if (text.length > 500) throw new Error('The reason must be 500 characters or less.');
  return text;
}

function reopenTask_(taskId, updatedAt, reason) {
  var text = reasonText_(reason, 'Enter why this task is being reopened.');
  return withTask_(taskId, function (sheet, task) {
    task.completedAt = '';
    task.reopenReason = text;
    task.status = '';
    task.status = deriveStatus_(task, Date.now());
    task.updatedAt = String(updatedAt || new Date().toISOString());
    writeRow_(sheet, task);
    return publicTask_(task);
  });
}

function holdTask_(taskId, updatedAt, reason) {
  var text = reasonText_(reason, 'Enter why this task is being put on hold.');
  return withTask_(taskId, function (sheet, task) {
    task.completedAt = '';
    task.holdReason = text;
    task.status = 'Hold';
    task.updatedAt = String(updatedAt || new Date().toISOString());
    writeRow_(sheet, task);
    return publicTask_(task);
  });
}

function releaseTask_(taskId, updatedAt) {
  return withTask_(taskId, function (sheet, task) {
    task.status = '';
    task.status = deriveStatus_(task, Date.now());
    task.updatedAt = String(updatedAt || new Date().toISOString());
    writeRow_(sheet, task);
    return publicTask_(task);
  });
}

function deleteTask_(taskId, updatedAt, reason) {
  var text = reasonText_(reason, 'Enter why this task is being deleted.');
  return withTask_(taskId, function (sheet, task) {
    task.status = 'Deleted';
    task.deleteReason = text;
    task.updatedAt = String(updatedAt || new Date().toISOString());
    writeRow_(sheet, task);
    return publicTask_(task);
  });
}

function withTask_(taskId, change) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = taskSheet_();
    var row = findRow_(sheet, taskId);
    if (!row) throw new Error('That task was not found.');
    var task = taskFromRow_(sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0], row);
    return change(sheet, task);
  } finally {
    lock.releaseLock();
  }
}

function validateTask_(input) {
  var title = String(input.title || '').trim();
  var description = String(input.description || '').trim();
  var dueDate = asDateString_(input.dueDate);
  var dueTime = asTimeString_(input.dueTime);
  var priority = String(input.priority || '').trim();
  if (!title) throw new Error('Enter a task title.');
  if (title.length > 180) throw new Error('The title must be 180 characters or less.');
  if (description.length > 2000) throw new Error('The description must be 2000 characters or less.');
  if (!deadlineMs_(dueDate, dueTime)) throw new Error('Enter a valid due date.');
  if (!PRIORITIES[priority]) throw new Error('Choose a priority.');
  return { title: title, description: description, dueDate: dueDate, dueTime: dueTime, priority: priority };
}

function deriveStatus_(task, now) {
  if (String(task.status || '') === 'Deleted') return 'Deleted';
  if (String(task.completedAt || '').trim()) return 'Complete';
  if (String(task.status || '') === 'Hold') return 'Hold';
  var deadline = deadlineMs_(task.dueDate, task.dueTime);
  if (!deadline) return 'To Do';
  if (now > deadline) return 'Pending';
  return 'To Do';
}

function deadlineMs_(dueDate, dueTime) {
  var date = String(dueDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!date) return null;
  var year = Number(date[1]);
  var month = Number(date[2]);
  var day = Number(date[3]);
  var hour = 23;
  var minute = 59;
  var second = 59;
  var ms = 999;
  if (dueTime) {
    var time = String(dueTime).match(/^(\d{2}):(\d{2})$/);
    if (!time) return null;
    hour = Number(time[1]);
    minute = Number(time[2]);
    if (hour > 23 || minute > 59) return null;
    second = 0;
    ms = 0;
  }
  var wall = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  var parsed = new Date(wall);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return wall - KOLKATA_OFFSET_MS;
}

function taskFromRow_(row, rowNumber) {
  var taskId = String(row[0] || '').trim();
  if (!taskId || taskId === 'taskId') return null;
  return {
    taskId: taskId,
    title: String(row[1] || ''),
    description: String(row[2] || ''),
    dueDate: asDateString_(row[3]),
    dueTime: asTimeString_(row[4]),
    priority: String(row[5] || ''),
    status: String(row[6] || ''),
    createdAt: asText_(row[7]),
    updatedAt: asText_(row[8]),
    completedAt: asText_(row[9]),
    reopenReason: String(row[10] || '').trim(),
    holdReason: String(row[11] || '').trim(),
    rescheduleReason: String(row[12] || '').trim(),
    deleteReason: String(row[13] || '').trim(),
    _row: rowNumber,
  };
}

function writeRow_(sheet, task) {
  sheet.getRange(task._row, 1, 1, HEADERS.length).setNumberFormat('@').setValues([HEADERS.map(function (name) {
    return task[name] || '';
  })]);
}

function writeCells_(sheet, row, values) {
  if (values.status !== undefined) sheet.getRange(row, 7).setNumberFormat('@').setValue(values.status);
  if (values.updatedAt !== undefined) sheet.getRange(row, 9).setNumberFormat('@').setValue(values.updatedAt);
}

function findRow_(sheet, taskId) {
  var wanted = String(taskId || '').trim();
  if (!wanted) return 0;
  var values = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 1).getValues();
  for (var index = 1; index < values.length; index += 1) {
    if (String(values[index][0]) === wanted) return index + 1;
  }
  return 0;
}

function publicTask_(task) {
  return {
    taskId: task.taskId,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    priority: task.priority,
    status: task.status,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
    reopenReason: task.reopenReason || '',
    holdReason: task.holdReason || '',
    rescheduleReason: task.rescheduleReason || '',
    deleteReason: task.deleteReason || '',
  };
}

function asDateString_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'Asia/Kolkata', 'yyyy-MM-dd');
  }
  var match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[1] + '-' + match[2] + '-' + match[3] : '';
}

function asTimeString_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'Asia/Kolkata', 'HH:mm');
  }
  var match = String(value || '').trim().match(/^(\d{2}):(\d{2})/);
  if (!match) return '';
  var hour = Number(match[1]);
  var minute = Number(match[2]);
  if (hour > 23 || minute > 59) return '';
  return match[1] + ':' + match[2];
}

function asText_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return String(value || '').trim();
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
