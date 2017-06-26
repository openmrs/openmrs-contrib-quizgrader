#!/bin/bash -eux

eval "cat <<EOF
$(</app/config/default-sample.json)
EOF
"> /app/config/default.json

/usr/local/bin/node /app/app.js
