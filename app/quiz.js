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

const config = require('config');
const log4js = require('log4js');
const logger = log4js.getLogger('quiz.js');
logger.level = config.get('logger.level');
const { google } = require('googleapis');
const SpreadsheetColumn = require('spreadsheet-column');
const scz = new SpreadsheetColumn({ zero: true });
// scz.fromInt(25) == 'Z'; scz.fromStr('AB') == 27

const SPREADSHEET_ID = config.get('quizSheet.spreadsheetId');
const KEY_ROW = config.get('quizSheet.keyRow');
const NAME_COL = config.get('quizSheet.nameCol');
const OPENMRS_ID_COL = config.get('quizSheet.openmrsIdCol');
const EMAIL_COL = config.get('quizSheet.emailCol');
const ISSUE_COL = config.get('quizSheet.issueCol');
const PR_COL = config.get('quizSheet.pullRequestCol');
const RESPONSE_START_ROW = config.get('quizSheet.responseStartRow');
const RESPONSE_START_COL = config.get('quizSheet.responseStartCol');
const RESPONSE_END_COL = config.get('quizSheet.responseEndCol');
const GRADE_COL = config.get('quizSheet.gradeCol');

// Convenience method to retrieve element based on sheet column letter
function getCol(arr, a1) {
  return arr[scz.fromStr(a1)];
}

// Convenience method to slice columns (by letters) out of a row array
function getCols(arr, fromA1, toA1) {
  return arr.slice(scz.fromStr(fromA1), scz.fromStr(toA1) + 1);
}

function getSheets() {
  const credentials = config.get('googleKey');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      ...credentials,
      private_key: credentials.private_key.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}

function getEntry(entries, i) {
  const values = entries[i];
  return {
    name: getCol(values, NAME_COL),
    email: getCol(values, EMAIL_COL),
    openmrsId: getCol(values, OPENMRS_ID_COL).replace(/[@ ]/g, '').toLowerCase(),
    issue: getCol(values, ISSUE_COL),
    pullRequest: getCol(values, PR_COL),
    responses: getCols(values, RESPONSE_START_COL, RESPONSE_END_COL),
    grade: getCol(values, GRADE_COL)
  };
}

function hasValidIssue(entry) {
  const re = /^https?:\/\/openmrs\.atlassian\.net\/browse\/|^https?:\/\/issues\.openmrs\.org\/browse\//;
  const isValid = entry.issue && re.test(entry.issue);
  if (!isValid) {
    logger.info(`Entry for ${entry.openmrsId} has invalid issue URL ("${entry.issue}")`);
  }
  return isValid;
}

function hasValidPullRequest(entry) {
  const re = /^https:\/\/github\.com\/openmrs\/.*\/pull\/\d+/;
  const isValid = entry.pullRequest && re.test(entry.pullRequest);
  if (!isValid) {
    logger.info(`Entry for ${entry.openmrsId} has invalid pull request URL ("${entry.pullRequest}")`);
  }
  return isValid;
}

function gradeEntry(key, entry) {
  let numCorrect = 0;
  for (let i = 0; i < key.length; i++) {
    if (key[i] === entry.responses[i]) {
      numCorrect++;
    }
  }
  return Math.floor((numCorrect / key.length) * 100);
}

async function verify() {
  const sheets = getSheets();
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A1'
  });
  if (!('values' in resp.data)) {
    throw new Error('Unable to read spreadsheet.');
  }
}

async function getKey(sheets) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${KEY_ROW}:${KEY_ROW}`
  });
  return getCols(resp.data.values[0], RESPONSE_START_COL, RESPONSE_END_COL);
}

async function getEntries(sheets) {
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '3:1000'
  });
  return resp.data.values;
}

async function recordGrade(sheets, i, grade) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: GRADE_COL + (RESPONSE_START_ROW + i),
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[grade]] }
  });
}

/*
 * Grades all entries that have not yet been graded, calling
 * callback(openmrsId, grade) for each entry that is graded.
 * Grade is an integer 0-100, representing the percentage correct.
 * If issue or pull request are invalid, then grade is 0.
 */
async function grade(callback) {
  const sheets = getSheets();
  const key = await getKey(sheets);
  const entries = await getEntries(sheets);
  for (let i = 0; i < entries.length; i++) {
    const entry = getEntry(entries, i);
    if (!entry.grade) {
      let gradeValue = gradeEntry(key, entry);
      let gradeLabel = gradeValue + '%';
      if (!hasValidIssue(entry)) {
        gradeLabel = 'Invalid Issue';
        gradeValue = 0;
      } else if (!hasValidPullRequest(entry)) {
        gradeLabel = 'Invalid PR';
        gradeValue = 0;
      }
      entry.grade = gradeLabel;
      await recordGrade(sheets, i, gradeLabel);
      callback(entry.openmrsId, gradeValue);
    }
  }
}

module.exports = { verify, grade };
