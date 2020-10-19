'use strict';

/*
 * Simple server to grade and process /dev/1 quiz entries. Entries 
 * are copied to a Google Spreadsheet. This app will scan the 
 * spreadsheet for any entries that have not been graded and, if found,
 * will grade them and notify the respondent of the result (granting 
 * the appropriate badge on Discourse if they passed).
 *
 * Routes:
 *  /				redirects to http://om.rs/devstages
 *  /ping		triggers any entries without grades to be graded
 *	/status	verifies connection to Google Sheet and Discourse
 *
 */

var log4js = require('log4js');
log4js.configure('log4js.json');
var logger = log4js.getLogger('app.js');
var express = require('express');
var Promise = require('bluebird');
var grader = require('./grader');

var PORT = process.env.PORT || 80;

var app = express();

app.get('/', function(req, res) {
	res.redirect('https://om.rs/devstages');
})

app.get('/ping', function(req, res) {
	res.status(204).end(); // instant reply to webhook
	logger.info('pong');
	grader.wakeup();
});

app.get('/status', function(req, res) {
	logger.info('status check');
	grader.verify().then(() => res.send('ok')).catch(
		err => res.status(500).send(err)
	);
});

app.listen(PORT);

logger.info("Server running at http://127.0.0.1:%s/", PORT);