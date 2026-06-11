'use strict';

/*
 * Grades quiz entries. Any quiz entries that have not been graded
 * will get graded and the respondent(s) notified and, for those
 * who pass, badges granted on Discourse.
 */

const config = require('config');
const log4js = require('log4js');
const logger = log4js.getLogger('grader.js');
logger.level = config.get('logger.level');
const quiz = require('./quiz');
const discourse = require('./discourse');
const fs = require('fs/promises');

const PASSING_GRADE = config.get('grader.passingGrade');
const BADGE_NAME = config.get('grader.badgeName');
const MIN_INTERVAL_SECONDS = config.get('grader.minIntervalSeconds');

let lastRun = null;
let passedTemplate;
let failedTemplate;

(async () => {
	try {
		[passedTemplate, failedTemplate] = await Promise.all([
			fs.readFile('./passed.md', 'utf8'),
			fs.readFile('./failed.md', 'utf8')
		]);
	} catch (err) {
		logger.error('Failed to read message templates.');
		logger.error(err);
	}
})();

async function handleGrade(openmrsId, grade) {
	if (grade >= PASSING_GRADE) {
		try {
			const badge = await discourse.getBadge(BADGE_NAME);
			await discourse.grantBadge(openmrsId, badge.id);
			await discourse.sendMessage(openmrsId, 'Congratulations Smart Developer!', passedTemplate);
			logger.info(`${openmrsId} granted ${BADGE_NAME}`);
		} catch (err) {
			logger.error(`Error granting badge to ${openmrsId}`);
			logger.error(err);
		}
	} else {
		try {
			await discourse.sendMessage(openmrsId, 'You did not pass the /dev/1 quiz', failedTemplate);
			logger.info(`${openmrsId} notified of failed quiz`);
		} catch (err) {
			logger.error(`Error notifying ${openmrsId} of failed quiz`);
			logger.error(err);
		}
	}
}

// Dummy function for debugging (skips notification or granting badge,
// but grade will still be populated in spreadsheet)
function dontHandleGrade(openmrsId, grade) {
	logger.debug(`Bypassed badge or notification for: ${openmrsId} (${grade})`);
}

function wakeup() {
	const now = Date.now();
	if (!lastRun || (now - lastRun > MIN_INTERVAL_SECONDS * 1000)) {
		lastRun = now;
		logger.debug('grading');
		quiz.grade(handleGrade).then(() => {
			logger.debug('grading completed');
		}).catch(err => {
			logger.error(err);
		});
	}
}

async function verify() {
	await quiz.verify();
	await discourse.verify();
	logger.debug('connections verified');
}

module.exports = { verify, wakeup };
