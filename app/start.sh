#!/bin/bash -eux

eval "cat <<EOF
$(</app/config/default-sample.json)
EOF
" 2> /dev/null > /app/config/default.json


/usr/local/bin/node /app/app.js
