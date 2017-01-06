'use strict';

/*
 * Simple Discourse API
 *
 * Assumes config contains discourse.host, discourse.apiUsername,
 * and discourse.apiKey.
 *
 */

var log4js = require('log4js');
var logger = log4js.getLogger('discourse.js');
var Promise = require('bluebird');
var https = require('https');
var config = require('config');

var HOST = config.get('discourse.host');
var API_USERNAME = config.get('discourse.apiUsername');
var API_KEY = config.get('discourse.apiKey');

/*
 * Get user by username.
 *
 * Usage:
 * 
 * discourse.getUser('username').then( user => {
 *   // do something with user
 * });
 */
var getUser = Promise.method(function(username) {
	return new Promise(function(resolve, reject) {
		var req = https.get('https://' + HOST + '/users/' + username + '.json' +
			'?api_key=' + API_KEY + '&api_username=' + API_USERNAME, (res) => {
			var rawData = '';
			res.on('data', (d) => { rawData += d; });
			res.on('end', () => resolve(JSON.parse(rawData)));
		});
		req.on('error', (err) => {
			logger.error(err);
			reject(err);
		});
		req.end();
	});
});

/*
 * Get badge by name.
 *
 * Usage:
 *
 * discourse.getBadge(name).then( badge => {
 *   // do something with badge
 * });
 */
var getBadge = Promise.method(function(badgeName) {
	return new Promise(function(resolve, reject) {
		var req = https.get('https://' + HOST + '/badges.json' +
			'?api_key=' + API_KEY + '&api_username=' + API_USERNAME, (res) => {
			var rawData = '';
			res.on('data', (d) => { rawData += d; });
			res.on('end', () => {
				var data = JSON.parse(rawData);
				var badges = data.badges;
				resolve(
					badges.find( (o) =>
						o.name.toLowerCase() == badgeName.toLowerCase()
					)
				);
			});
		});
		req.on('error', (err) => {
			logger.error(err);
			reject(err);
		});
		req.end();
	});
});

/*
 * Grant badge to user.
 *
 * Usage:
 *
 * discourse.grantBadge(username, badge_id).then( user => {
 *   // do something with user if you wish
 * });
 */
var grantBadge = Promise.method(function(username, badgeId) {
	return new Promise(function(resolve, reject) {
		var options = {
			hostname: 'talk.openmrs.org',
			port: 443,
			path: '/user_badges.json?api_key=' + API_KEY +
				'&api_username=' + API_USERNAME + 
				'&badge_id=' + badgeId + '&username=' + username,
			method: 'POST',
			headers: {
				'Content-type': 'application/x-www-form-urlencoded',
				'Content-Length': 0
			}
		};
		var req = https.request(options, (res) => {
			var rawData = '';
			res.on('data', (d) => { rawData += d; });
			res.on('end', () => {
				resolve(JSON.parse(rawData));
			});
		});
		req.on('error', (err) => {
			logger.error(err);
			reject(err);
		});
		req.write('');
		req.end();
	});
});

/*
 * Send message to user.
 *
 * Usage:
 *
 * discourse.sendMessage(username, title, message).then( post => {
 *   // do something with private message post if you wish
 * });
 */
var sendMessage = Promise.method(function(username, title, message) {
	return new Promise(function(resolve, reject) {
		var options = {
			hostname: 'talk.openmrs.org',
			port: 443,
			path: '/posts.json?api_key=' + API_KEY +
				'&api_username=' + API_USERNAME + 
				'&archetype=private_message&title=' + 
				encodeURIComponent(title) + '&raw=' + 
				encodeURIComponent(message) + '&target_usernames=' + username,
			method: 'POST',
			headers: {
				'Content-type': 'application/x-www-form-urlencoded',
				'Content-Length': 0
			}
		};
		var req = https.request(options, (res) => {
			var rawData = '';
			res.on('data', (d) => { rawData += d; });
			res.on('end', () => {
				resolve(JSON.parse(rawData));
			});
		});
		req.on('error', (err) => {
			logger.error(err);
			reject(err);
		});
		req.write('');
		req.end();
	});
});

/*
 * Verify connectivity with discourse. This is done by trying to
 * fetch the API user's user record.
 *
 * Usage:
 *
 * discourse.verify().then( () => {
 *   // success
 * }).catch( err => {
 *   // failure
 * });
 */
function verify() {
	return new Promise(function(resolve, reject) {
		getUser(API_USERNAME).then(resolve('verified')).catch( err => reject(err));
	})
}

module.exports = {
	getUser: getUser,
	getBadge: getBadge,
	grantBadge: grantBadge,
	sendMessage: sendMessage,
	verify: verify
};