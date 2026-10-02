# Build the frontend bundle once, then run the server (through tsx, as `npm start` does) against
# a production install that drops the dev dependencies.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY server/package.json server/
# --ignore-scripts skips the root `prepare` (lefthook install), which has no .git here to act on.
RUN npm ci --ignore-scripts
COPY web web
RUN npm run build -w web

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY server/package.json server/
# --ignore-scripts keeps the root `prepare` (lefthook install) from running, since lefthook is a
# dev dependency that `--omit=dev` drops.
RUN npm ci --omit=dev --ignore-scripts
COPY server/src server/src
COPY server/migrations server/migrations
COPY --from=build /app/web/dist web/dist
EXPOSE 8100
CMD ["npm", "run", "start", "-w", "server"]