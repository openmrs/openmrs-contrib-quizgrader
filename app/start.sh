#!/bin/bash -eux

eval "cat <<EOF
$(</app/config/default-sample.json)
EOF
"> /app/config/default.json

mkdir -p logs
touch logs/quizgrader.log

/usr/local/bin/node /app/app.js
