FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && mkdir /app/data && chown node:node /app/data
COPY --chown=node:node server.mjs ./
USER node
ENV HOST=0.0.0.0 PORT=8787 DATABASE_PATH=/app/data/contact.sqlite
EXPOSE 8787
CMD ["node", "server.mjs"]
