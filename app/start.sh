#!/bin/sh -eux

mkdir -p logs
touch logs/quizgrader.log

/usr/local/bin/node /app/app.js
