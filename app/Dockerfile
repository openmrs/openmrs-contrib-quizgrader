FROM mhart/alpine-node:6

RUN npm install --global express pg

ENV NODE_PATH=/usr/local/lib/node_modules

VOLUME /app

EXPOSE 80

WORKDIR /app

CMD ["node", "/app/app.js"]
