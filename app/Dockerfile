FROM node:7

ENV NODE_PATH=/usr/local/lib/node_modules
RUN npm install
COPY . /app
RUN chmod a+x /app/start.sh

EXPOSE 80
WORKDIR /app
CMD ["/app/start.sh"]
