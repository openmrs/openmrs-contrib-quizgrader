'use strict';

/*
 * Simple API for access to OpenMRS /dev/1 quiz. We assume the 
 * quiz key and responses are stored in a Google Spreadsheet that 
 * is populated from something like SurveyMonkey. One row is used 
 * as the key (containing the correct answers) and at some row 
 * respondents' responses begin (one row per quiz taken) with some 
 * specific columns (OpenMRS ID, JIRA issue URL, etc.) and then a 
 * continugous set of columns containing answers to quiz questions.
 * We also assume the key and individual responses are aligned, such 
 * that the correct answer in the key is in the same colunn as the 
 * individual's response. Outside of this range, a column is reserved 
 * for entering a grade (as a percentage), which we can populate.
 *
 * A service key for the google sheets api should be generated and 
 * its JSON values entered in the config under "googleKey". The email 
 * address for this service key should be added with edit (read/write) 
 * privileges on the google spreadsheet.
 *
 * Assumes the following config settings under "quizSheet":
 *  spreadSheetId - ID of google spreadsheet
 *  keyRow - the row of the spreadsheet containing correct answers
 *  nameCol - column (letter) containing respondent's name
 *  openmrsIdCol - columnn (letter) containing respondent's OpenMRS ID
 *  emailCol - column (letter) containing respondent's email
 *  issueCol - column (letter) containing URL of issue claimed
 *  pullRequestCol - column (letter) containing URL of PR submitted
 *  responseStartRow - row in which responses start
 *  responseStartCol - first column (letter) of respondent's answers
 *  responseEndCol - last column (letter) of respondent's answers
 *  gradeCol - column (letter) where grade (percentage) should be written
 */

var config = require('config');
var log4js = require('log4js');
var logger = log4js.getLogger('quiz.js');
logger.level = config.get('logger.level');
var { google } = require('googleapis');
var sheets = google.sheets({version:'v4'});
var SpreadsheetColumn = require('spreadsheet-column');
var scz = new SpreadsheetColumn({zero: true});
// scz.fromInt(25) == 'Z'; scz.fromStr('AB') == 27
var Promise = require('bluebird');
var getValues = Promise.promisify(sheets.spreadsheets.values.get.bind(sheets));
var updateValues = Promise.promisify(sheets.spreadsheets.values.update.bind(sheets));

var SPREADSHEET_ID = config.get('quizSheet.spreadsheetId');
var KEY_ROW = config.get('quizSheet.keyRow');
var NAME_COL = config.get('quizSheet.nameCol');
var OPENMRS_ID_COL = config.get('quizSheet.openmrsIdCol');
var EMAIL_COL = config.get('quizSheet.emailCol');
var ISSUE_COL = config.get('quizSheet.issueCol');
var PR_COL = config.get('quizSheet.pullRequestCol');
var RESPONSE_START_ROW = config.get('quizSheet.responseStartRow');
var RESPONSE_START_COL = config.get('quizSheet.responseStartCol');
var RESPONSE_END_COL = config.get('quizSheet.responseEndCol');
var GRADE_COL = config.get('quizSheet.gradeCol');

// Convenience method to retrieve element based on sheet column letter
function getCol(arr, a1) {
  return arr[scz.fromStr(a1)];
}

// Convenience method to slice columns (by letters) out of a row array
function getCols(arr, fromA1, toA1) {
  return arr.slice(scz.fromStr(fromA1), scz.fromStr(toA1)+1);
}

var auth = Promise.coroutine(function* () {
  var googleKey = config.get('googleKey');
  var authClient = new google.auth.JWT(
    googleKey.client_email, null,
    googleKey.private_key,
    ['https://www.googleapis.com/auth/spreadsheets'],
    null
  );
  Promise.promisify(authClient.authorize, {context:authClient})();
  return yield Promise.resolve(authClient)
});

var getKey = Promise.method(function(authClient) {
  return new Promise(function(resolve, reject) {
    getValues({
      spreadsheetId: SPREADSHEET_ID,
      range: KEY_ROW + ':' + KEY_ROW,
      auth: authClient    
    }).then(resp => {
      var values = resp.data.values[0];
      var answers = getCols(values, RESPONSE_START_COL, RESPONSE_END_COL);
      resolve(answers);
    }).catch(err => {
      logger.error(JSON.stringify(err));
      reject(err);
    });
  });
});

var getEntries = Promise.method(function(authClient) {
  return new Promise(function(resolve, reject) {
    getValues({
      spreadsheetId: SPREADSHEET_ID,
      range: '3:1000',
      auth: authClient      
    }).then(resp => {
      var values = resp.data.values;
      resolve(values);
    }).catch(err => {
      logger.error(JSON.stringify(err));
      reject(err);
    });
  });
});

function getEntry(entries, i) {
  var values = entries[i];
  var name = getCol(values, NAME_COL);
  var email = getCol(values, EMAIL_COL);
  var openmrsId = getCol(values, OPENMRS_ID_COL);
  var issue = getCol(values, ISSUE_COL);
  var pullRequest = getCol(values, PR_COL);
  var responses = getCols(values, RESPONSE_START_COL, RESPONSE_END_COL);
  var grade = getCol(values, GRADE_COL);
  return {
    name: name,
    email: email,
    openmrsId: openmrsId.replace(/[@ ]/g, '').toLowerCase(),
    issue: issue,
    pullRequest: pullRequest,
    responses: responses,
    grade: grade
  };
}

function hasValidIssue(entry) {
  var re = new RegExp('https?://issues\\.openmrs\\.org/browse/');
  var isValid = entry.issue && (entry.issue.search(re) != -1);
  if (!isValid) {
    logger.info('Entry for ' + entry.openmrsId + 
      ' has invalid issue URL ("' + entry.issue + 
      '" does not match "' + re + '")');
  }
  return isValid;
}

function hasValidPullRequest(entry) {
  var re = new RegExp('https://github\\.com/openmrs/.*/pull/\\d+');
  var isValid = entry.pullRequest && (entry.pullRequest.search(re) != -1);
  if (!isValid) {
    logger.info('Entry for ' + entry.openmrsId + 
      ' has invalid pull request URL ("' + entry.pullRequest +
      '" does not match "' + re + '")');
  }
  return isValid;
}

function gradeEntry(key, entry) {
  var numCorrect = 0;
  for (var i=0; i<key.length; i++) {
    if (key[i] == entry.responses[i]) {
      numCorrect++;
    }
  }
  return Math.floor((numCorrect/key.length)*100);
}

var verify = Promise.coroutine(function* () {
  var authClient = yield auth();
  var testRead = yield getValues({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A1',
    auth: authClient
  });
  var verifyRead = yield new Promise(function(resolve, reject) {
    if (testRead && ('values' in testRead.data)) {
      resolve('ok');
    } else {
      reject('Unable to read spreadsheet.');
    }
  });
  return;
});

/*
 * Grades all entries that have not yet been graded, calling
 * callback(openmrsId, grade) for each entry that is graded.
 * Grade is an integer 0-100, representing the percentage correct.
 * If issue or pull request are invalid, then grade is 0.
 */
var grade = Promise.coroutine(function* (callback) {
  var authClient = yield auth();
  var key = yield getKey(authClient);
  var entries = yield getEntries(authClient);
  for (var i=0; i<entries.length; i++) {
    var entry = getEntry(entries, i);
    if (!entry.grade) {
      var gradeValue = gradeEntry(key, entry);
      var grade = gradeValue + '%';
      var issueValid = hasValidIssue(entry);
      var prValid = hasValidPullRequest(entry);
      if (!issueValid) {
        grade = 'Invalid Issue';
        gradeValue = 0;
      } else if (!prValid) {
        grade = 'Invalid PR';
        gradeValue = 0;
      }
      entry.grade = grade;
      yield recordGrade(authClient, i, grade);
      callback(entry.openmrsId, gradeValue);
    }
  }
  return;
});

var recordGrade = Promise.method(function(authClient, i, grade) {
  return new Promise(function(resolve, reject) {
    updateValues({
      spreadsheetId: SPREADSHEET_ID,
      range: GRADE_COL + (RESPONSE_START_ROW  + i),
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [ [ grade ] ]
      },
      auth: authClient
    }).then( resp => {
      resolve(resp);
    }).catch( err => {
      logger.error(JSON.stringify(err));
      reject(err);
    })
  });
});

module.exports = {
  verify: verify,
  grade: grade
};