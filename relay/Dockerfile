# Node on Alpine, no dependencies.
FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
