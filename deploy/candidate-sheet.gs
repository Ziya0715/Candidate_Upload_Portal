var SPREADSHEET_ID = '1tinwvrnfxPQyK4OMLaYW9iXCWFAem2iOgaTG720gh0E';
var SHEET_GID = 0;

function doGet() {
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheets = spreadsheet.getSheets();
  var sheet = sheets[0];
  for (var index = 0; index < sheets.length; index += 1) {
    if (sheets[index].getSheetId() === SHEET_GID) {
      sheet = sheets[index];
      break;
    }
  }

  var values = sheet.getDataRange().getValues();
  var rows = values.map(function (row) {
    return row.map(function (cell) {
      if (Object.prototype.toString.call(cell) === '[object Date]') {
        return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      return cell === null || cell === undefined ? '' : String(cell);
    });
  });

  return json_({ rows: rows });
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
