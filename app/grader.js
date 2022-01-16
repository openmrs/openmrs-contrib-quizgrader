'use strict';

/*
 * Grades quiz entries. Any quiz entries that have not been graded
 * will get graded and the respondent(s) notified and, for those 
 * who pass, badges granted on Discourse.
 */

var config = require('config');
var log4js = require('log4js');
var logger = log4js.getLogger('grader.js');
logger.level = config.get('logger.level');
var quiz = require('./quiz');
var discourse = require('./discourse');
var Promise = require('bluebird');
var fs = require('fs');

var PASSING_GRADE = config.get('grader.passingGrade');
var BADGE_NAME = config.get('grader.badgeName');
var MIN_INTERVAL_SECONDS = config.get('grader.minIntervalSeconds');

var lastRun = null;

var passedTemplate;
fs.readFile('./passed.md', 'utf8', (err, data) => {
	if (err) {
		logger.error('Failed to read passed template.');
		logger.error(err);
	}
	passedTemplate = data;
});
var failedTemplate;
fs.readFile('./failed.md', 'utf8', (err, data) => {
	if (err) {
		logger.error('Failed to read failed template.');
		logger.error(err);
	}
	failedTemplate = data;
});

var handleGrade = function(openmrsId, grade) {
	var passed = grade >= PASSING_GRADE;
	if (passed) {
		Promise.coroutine(function* () {
			var badge = yield discourse.getBadge(BADGE_NAME);
			yield discourse.grantBadge(openmrsId, badge.id);
			var subject = 'Congratulations Smart Developer!';
			var message = passedTemplate;
			yield discourse.sendMessage(openmrsId, subject, message);
		})().then( () => {
			logger.info(openmrsId + ' granted ' + BADGE_NAME);
		}).catch( err => {
			logger.error('Error granting badge to ' + openmrsId);
			logger.error(err);
		});
	} else {
		Promise.coroutine(function* () {
			var subject = 'You did not pass the /dev/1 quiz';
			var message = failedTemplate;
			yield discourse.sendMessage(openmrsId, subject, message);			
		})().then( () => {
			logger.info(openmrsId + ' notified of failed quiz');
		}).catch( err => {
			logger.error('Error notifying ' + openmrsId + ' of failed quiz');
			logger.error(err);
		});
	}
};

// Dummy function for debugging (skips notification or granting badge,
// but grade will still be populated in spreadsheet)
var dontHandleGrade = function(openmrsId, grade) {
	logger.debug('Bypassed badge or notification for: ' +
		openmrsId + ' (' + grade + ')');
}

var wakeup = function() {
	var now = new Date().getTime();
	if (!lastRun || (now - lastRun > MIN_INTERVAL_SECONDS*1000)) {
		lastRun = now;
		logger.debug('grading');
		quiz.grade(handleGrade).then( () => {
			logger.debug('grading completed');
		}).catch( err => {
			logger.error(err);
		});
	}
};

var verify = Promise.coroutine(function* () {
	yield quiz.verify();
	yield discourse.verify();
	logger.debug('connections verified');
});

module.exports = {
	verify: verify,
	wakeup: wakeup
};