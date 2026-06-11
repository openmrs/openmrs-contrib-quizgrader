'use strict';

/*
 * Simple Discourse API
 *
 * Assumes config contains discourse.host, discourse.apiUsername,
 * and discourse.apiKey.
 *
 */

const log4js = require('log4js');
const logger = log4js.getLogger('discourse.js');
const config = require('config');

const HOST = config.get('discourse.host');
const API_USERNAME = config.get('discourse.apiUsername');
const API_KEY = config.get('discourse.apiKey');

function apiHeaders() {
	return {
		'Accept': 'application/json',
		'Api-Username': API_USERNAME,
		'Api-Key': API_KEY
	};
}

async function getUser(username) {
	const res = await fetch(`https://${HOST}/users/${username}.json`, {
		headers: apiHeaders()
	});
	if (!res.ok) {
		logger.warn(`Unexpected response when getting user ${username}: ${res.status} ${res.statusText}`);
		throw new Error(await res.text());
	}
	return res.json();
}

async function getBadge(badgeName) {
	const res = await fetch(`https://${HOST}/badges.json`, {
		headers: apiHeaders()
	});
	if (!res.ok) {
		logger.warn(`Unexpected response when getting badge info for ${badgeName}: ${res.status} ${res.statusText}`);
		throw new Error(await res.text());
	}
	const data = await res.json();
	return data.badges.find(b => b.name.toLowerCase() === badgeName.toLowerCase());
}

async function grantBadge(username, badgeId) {
	const url = `https://${HOST}/user_badges.json?badge_id=${badgeId}&username=${username}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { ...apiHeaders(), 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': '0' }
	});
	if (!res.ok) {
		logger.warn(`Unexpected response when granting badge ${badgeId} to ${username}: ${res.status} ${res.statusText}`);
		throw new Error(await res.text());
	}
	return res.json();
}

async function sendMessage(username, title, message) {
	const url = `https://${HOST}/posts.json?archetype=private_message&title=${encodeURIComponent(title)}&raw=${encodeURIComponent(message)}&target_usernames=${username}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { ...apiHeaders(), 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': '0' }
	});
	if (!res.ok) {
		logger.warn(`Unexpected response when notifying user ${username}: ${res.status} ${res.statusText}`);
		throw new Error(await res.text());
	}
	return res.json();
}

async function verify() {
	await getUser(API_USERNAME);
}

module.exports = { getUser, getBadge, grantBadge, sendMessage, verify };
